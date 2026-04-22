import {
  burnPresets,
  getBurnPreset,
  presetIdValues,
  presetIdSchema,
  providerValues,
  providerSchema,
  type PresetId,
  type ProviderId,
} from "@token-burner/shared";

import { CliArgsError, parseArgs, requireFlag } from "../args.js";
import { ApiError, type FetchLike } from "../api/client.js";
import { loadLocalConfig } from "../config/local-store.js";
import { defaultBaseUrl } from "../config/defaults.js";
import { createAnthropicAdapter } from "../providers/anthropic.js";
import { createOpenAIAdapter } from "../providers/openai.js";
import { resolveProviderCredentials } from "../providers/resolve-credentials.js";
import {
  ProviderCredentialsMissingError,
  type ProviderAdapter,
  type ProviderCredentials,
} from "../providers/types.js";
import { runBurn, type RunBurnResult } from "../runtime/run-burn.js";
import type { CommandIo } from "./register.js";

export type BurnCommandOptions = {
  args: string[];
  io?: Partial<CommandIo>;
  fetchImpl?: FetchLike;
  homeDir?: string;
  adapterFactory?: (credentials: ProviderCredentials) => ProviderAdapter;
  credentialsResolver?: typeof resolveProviderCredentials;
  disableParentWatch?: boolean;
};

const defaultAdapterFactory = (
  credentials: ProviderCredentials,
): ProviderAdapter => {
  if (credentials.providerId === "anthropic") {
    return createAnthropicAdapter(credentials);
  }
  if (credentials.providerId === "openai") {
    return createOpenAIAdapter(credentials);
  }
  throw new Error(
    `provider ${credentials.providerId} is not wired in this build.`,
  );
};

const parseProvider = (value: string): ProviderId => providerSchema.parse(value);

const tokenSuffixMultipliers: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
};

export const parseTokenTarget = (value: string): number => {
  const trimmed = value.trim().toLowerCase().replace(/[_,]/g, "");

  const suffixMatch = trimmed.match(/^(\d+(?:\.\d+)?)([kmb])$/);
  if (suffixMatch) {
    const base = Number(suffixMatch[1]);
    const multiplier = tokenSuffixMultipliers[suffixMatch[2]];
    const result = Math.round(base * multiplier);
    if (Number.isInteger(result) && result > 0) {
      return result;
    }
  }

  const plain = Number(trimmed);
  if (Number.isInteger(plain) && plain > 0) {
    return plain;
  }

  throw new CliArgsError(
    "--target must be a positive integer or shorthand like 5k, 250k, 2.5m, 1b",
  );
};

export const formatBurnUsage = (): string =>
  `token-burner burn --provider <${providerValues.join("|")}> (--target N | --preset ${presetIdValues.join("|")}) [--base-url URL]`;

export const formatBurnHelp = (): string => {
  const presetLines = burnPresets.map(
    (preset) =>
      `  ${preset.id.padEnd(7)}${preset.label} (${preset.targetTokens.toLocaleString()} billed tokens)`,
  );

  return [
    "token-burner burn",
    "",
    "Usage:",
    `  ${formatBurnUsage()}`,
    "",
    "Use exactly one of --target or --preset.",
    "",
    "Options:",
    `  --provider <${providerValues.join("|")}>`,
    "  --target N",
    `  --preset <${presetIdValues.join("|")}>`,
    "  --base-url URL",
    "",
    "Preset tiers:",
    ...presetLines,
    "",
    "Examples:",
    "  token-burner burn --provider anthropic --target 50000",
    "  token-burner burn --provider openai --preset tier-2",
  ].join("\n");
};

export const runBurnCommand = async ({
  args,
  io,
  fetchImpl,
  homeDir,
  adapterFactory = defaultAdapterFactory,
  credentialsResolver = resolveProviderCredentials,
  disableParentWatch,
}: BurnCommandOptions): Promise<number> => {
  const stdout = io?.stdout ?? process.stdout;
  const stderr = io?.stderr ?? process.stderr;

  let provider: ProviderId;
  let targetTokens: number;
  let presetId: PresetId | null;
  let baseUrlOverride: string | undefined;
  try {
    const { flags } = parseArgs(args);
    provider = parseProvider(requireFlag(flags, "provider"));
    const presetFlag = flags.preset;
    const targetFlag = flags.target;
    if (presetFlag && targetFlag) {
      throw new CliArgsError(
        "pass --preset or --target, not both. the preset's target is authoritative.",
      );
    }
    if (presetFlag) {
      const parsedPresetId = presetIdSchema.parse(presetFlag);
      presetId = parsedPresetId;
      targetTokens = getBurnPreset(parsedPresetId).targetTokens;
    } else {
      presetId = null;
      targetTokens = parseTokenTarget(requireFlag(flags, "target"));
    }
    baseUrlOverride = flags["base-url"];
  } catch (error) {
    if (error instanceof CliArgsError) {
      stderr.write(`${error.message}\n`);
      stderr.write(`usage: ${formatBurnUsage()}\n`);
      return 2;
    }
    throw error;
  }

  const config = await loadLocalConfig({ homeDir });
  if (!config) {
    stderr.write(
      "no local token-burner config. run `register` or `link` first.\n",
    );
    return 1;
  }

  const baseUrl = baseUrlOverride ?? config.baseUrl ?? defaultBaseUrl;

  let adapter: ProviderAdapter;
  try {
    const credentials = credentialsResolver(provider);
    adapter = adapterFactory(credentials);
  } catch (error) {
    if (error instanceof ProviderCredentialsMissingError) {
      stderr.write(`${error.message}\n`);
      return 1;
    }
    throw error;
  }

  stdout.write(
    `starting burn: provider=${provider} model=${adapter.model} target=${targetTokens}\n`,
  );

  let result: RunBurnResult;
  try {
    result = await runBurn({
      ownerToken: config.ownerToken,
      agentInstallationId: config.agentInstallationId,
      provider,
      targetTokens,
      presetId,
      adapter,
      apiOptions: { baseUrl, fetchImpl },
      onProgress: (snapshot) => {
        stdout.write(
          `  step ${snapshot.stepIndex}: +${snapshot.stepInputTokens}in/${snapshot.stepOutputTokens}out → ${snapshot.totalBilledTokens}/${snapshot.targetTokens}\n`,
        );
      },
      parentWatch: disableParentWatch ? { enabled: false } : undefined,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      stderr.write(`burn failed: ${error.message} (HTTP ${error.status})\n`);
      return 1;
    }
    throw error;
  }

  stdout.write(
    `burn ${result.terminalStatus}: ${result.totalBilledTokens} billed tokens over ${result.steps} step(s) (${result.stopReason})\n`,
  );
  stdout.write(`burn id: ${result.burnId}\n`);
  return result.terminalStatus === "completed" ? 0 : 1;
};

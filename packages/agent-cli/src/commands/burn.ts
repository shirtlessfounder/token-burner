import {
  getBurnPreset,
  presetIdSchema,
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

const parsePositiveInt = (value: string, label: string): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new CliArgsError(`--${label} must be a positive integer`);
  }
  return parsed;
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
      targetTokens = parsePositiveInt(
        requireFlag(flags, "target"),
        "target",
      );
    }
    baseUrlOverride = flags["base-url"];
  } catch (error) {
    if (error instanceof CliArgsError) {
      stderr.write(`${error.message}\n`);
      stderr.write(
        "usage: token-burner-agent burn --provider anthropic (--target N | --preset tier-1|tier-2|tier-3) [--base-url URL]\n",
      );
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

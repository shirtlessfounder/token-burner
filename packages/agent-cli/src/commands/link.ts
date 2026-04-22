import { CliArgsError, parseArgs, requireFlag } from "../args.js";
import { ApiError, linkAgent, type FetchLike } from "../api/client.js";
import {
  loadLocalConfig,
  saveLocalConfig,
  type LocalConfig,
} from "../config/local-store.js";
import { defaultBaseUrl } from "../config/defaults.js";
import type { CommandIo } from "./register.js";

export type LinkCommandOptions = {
  args: string[];
  io?: Partial<CommandIo>;
  fetchImpl?: FetchLike;
  homeDir?: string;
};

export const runLinkCommand = async ({
  args,
  io,
  fetchImpl,
  homeDir,
}: LinkCommandOptions): Promise<number> => {
  const stdout = io?.stdout ?? process.stdout;
  const stderr = io?.stderr ?? process.stderr;

  let agentLabel: string;
  let baseUrlOverride: string | undefined;
  let ownerTokenOverride: string | undefined;
  try {
    const { flags } = parseArgs(args);
    agentLabel = requireFlag(flags, "agent-label");
    baseUrlOverride = flags["base-url"];
    ownerTokenOverride = flags["owner-token"];
  } catch (error) {
    if (error instanceof CliArgsError) {
      stderr.write(`${error.message}\n`);
      stderr.write(
        "usage: token-burner-agent link --agent-label LABEL [--owner-token TOKEN] [--base-url URL]\n",
      );
      return 2;
    }
    throw error;
  }

  const existing = await loadLocalConfig({ homeDir });
  const ownerToken = ownerTokenOverride ?? existing?.ownerToken;
  if (!ownerToken) {
    stderr.write(
      "no local owner token found. run `register` first, or pass --owner-token.\n",
    );
    return 1;
  }

  const baseUrl = baseUrlOverride ?? existing?.baseUrl ?? defaultBaseUrl;

  try {
    const response = await linkAgent(
      { ownerToken, agentLabel },
      { baseUrl, fetchImpl },
    );

    const nextConfig: LocalConfig = {
      humanId: response.humanId,
      agentInstallationId: response.agentInstallationId,
      ownerToken,
      baseUrl,
    };
    await saveLocalConfig(nextConfig, { homeDir });

    stdout.write(
      `linked installation ${response.agentInstallationId} to ${response.handle} ${response.avatar}\n`,
    );
    return 0;
  } catch (error) {
    if (error instanceof ApiError) {
      stderr.write(`link failed: ${error.message} (HTTP ${error.status})\n`);
      return 1;
    }
    throw error;
  }
};

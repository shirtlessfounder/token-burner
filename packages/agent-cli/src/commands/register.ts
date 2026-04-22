import { CliArgsError, parseArgs, requireFlag } from "../args.js";
import { ApiError, registerAgent, type FetchLike } from "../api/client.js";
import {
  saveLocalConfig,
  type LocalConfig,
} from "../config/local-store.js";
import { defaultBaseUrl } from "../config/defaults.js";

export type CommandIo = {
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
};

export type RegisterCommandOptions = {
  args: string[];
  io?: Partial<CommandIo>;
  fetchImpl?: FetchLike;
  homeDir?: string;
};

export const runRegisterCommand = async ({
  args,
  io,
  fetchImpl,
  homeDir,
}: RegisterCommandOptions): Promise<number> => {
  const stdout = io?.stdout ?? process.stdout;
  const stderr = io?.stderr ?? process.stderr;

  let claimCode: string;
  let publicHandle: string;
  let avatar: string;
  let agentLabel: string;
  let baseUrl: string;
  try {
    const { flags } = parseArgs(args);
    claimCode = requireFlag(flags, "claim-code");
    publicHandle = requireFlag(flags, "handle");
    avatar = requireFlag(flags, "avatar");
    agentLabel = requireFlag(flags, "agent-label");
    baseUrl = flags["base-url"] ?? defaultBaseUrl;
  } catch (error) {
    if (error instanceof CliArgsError) {
      stderr.write(`${error.message}\n`);
      stderr.write(
        "usage: token-burner-agent register --claim-code CODE --handle NAME --avatar X --agent-label LABEL [--base-url URL]\n",
      );
      return 2;
    }
    throw error;
  }

  try {
    const response = await registerAgent(
      { claimCode, publicHandle, avatar, agentLabel },
      { baseUrl, fetchImpl },
    );

    const config: LocalConfig = {
      humanId: response.humanId,
      agentInstallationId: response.agentInstallationId,
      ownerToken: response.ownerToken,
      baseUrl,
    };
    await saveLocalConfig(config, { homeDir });

    stdout.write(
      `registered as ${response.handle} ${response.avatar} (${response.humanId})\n`,
    );
    stdout.write(`installation: ${response.agentInstallationId}\n`);
    stdout.write(`owner token saved locally. keep it — it links future installs.\n`);
    return 0;
  } catch (error) {
    if (error instanceof ApiError) {
      stderr.write(`register failed: ${error.message} (HTTP ${error.status})\n`);
      return 1;
    }
    throw error;
  }
};

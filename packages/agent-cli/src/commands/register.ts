import { CliArgsError, parseArgs, requireFlag } from "../args.js";
import { ApiError, registerAgent, type FetchLike } from "../api/client.js";
import {
  getLocalConfigPath,
  loadLocalConfig,
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

const isWriteAccessError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return code === "EACCES" || code === "EROFS" || code === "EPERM";
};

const writeConfigOrReportPermission = async (
  config: LocalConfig,
  homeDir: string | undefined,
  stderr: NodeJS.WritableStream,
): Promise<boolean> => {
  try {
    await saveLocalConfig(config, { homeDir });
    return true;
  } catch (error) {
    if (isWriteAccessError(error)) {
      const path = getLocalConfigPath({ homeDir });
      stderr.write(
        `cannot write to ${path} (permission denied / read-only filesystem).\n`,
      );
      stderr.write(
        `if HOME is sandboxed, point the cli at a writable directory:\n`,
      );
      stderr.write(`  HOME=$(mktemp -d) npx token-burner ...\n`);
      return false;
    }
    throw error;
  }
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
  let overwrite: boolean;
  try {
    const { flags } = parseArgs(args);
    claimCode = requireFlag(flags, "claim-code");
    publicHandle = requireFlag(flags, "handle");
    avatar = requireFlag(flags, "avatar");
    agentLabel = requireFlag(flags, "agent-label");
    baseUrl = flags["base-url"] ?? defaultBaseUrl;
    overwrite = flags.overwrite !== undefined;
  } catch (error) {
    if (error instanceof CliArgsError) {
      stderr.write(`${error.message}\n`);
      stderr.write(
        "usage: token-burner register --claim-code CODE --handle NAME --avatar X --agent-label LABEL [--base-url URL] [--overwrite]\n",
      );
      return 2;
    }
    throw error;
  }

  if (!overwrite) {
    const existing = await loadLocalConfig({ homeDir });
    if (existing) {
      const path = getLocalConfigPath({ homeDir });
      const handleSummary = existing.publicHandle
        ? ` for handle "${existing.publicHandle}"`
        : "";
      stderr.write(
        `local token-burner config already exists at ${path}${handleSummary}.\n`,
      );
      stderr.write(
        "to add this installation to that identity instead, run:\n",
      );
      stderr.write(`  npx token-burner link --agent-label ${agentLabel}\n`);
      stderr.write(
        "to wipe the existing identity and register a new one, re-run with --overwrite.\n",
      );
      return 1;
    }
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
      publicHandle: response.handle,
      avatar: response.avatar,
    };
    if (!(await writeConfigOrReportPermission(config, homeDir, stderr))) {
      return 1;
    }

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

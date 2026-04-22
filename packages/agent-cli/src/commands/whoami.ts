import { loadLocalConfig } from "../config/local-store.js";
import type { CommandIo } from "./register.js";

export type WhoamiCommandOptions = {
  io?: Partial<CommandIo>;
  homeDir?: string;
};

const redactOwnerToken = (ownerToken: string): string => {
  if (ownerToken.length <= 16) {
    return "tb_owner_…";
  }
  return `${ownerToken.slice(0, 12)}…${ownerToken.slice(-4)}`;
};

export const runWhoamiCommand = async ({
  io,
  homeDir,
}: WhoamiCommandOptions = {}): Promise<number> => {
  const stdout = io?.stdout ?? process.stdout;
  const stderr = io?.stderr ?? process.stderr;

  const config = await loadLocalConfig({ homeDir });
  if (!config) {
    stderr.write("no local token-burner config. run `register` first.\n");
    return 1;
  }

  stdout.write(`humanId:         ${config.humanId}\n`);
  stdout.write(`installationId:  ${config.agentInstallationId}\n`);
  stdout.write(`ownerToken:      ${redactOwnerToken(config.ownerToken)}\n`);
  stdout.write(`baseUrl:         ${config.baseUrl}\n`);
  return 0;
};

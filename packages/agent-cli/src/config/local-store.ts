import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export type LocalConfig = {
  agentInstallationId: string;
  baseUrl: string;
  humanId: string;
  ownerToken: string;
};

type LocalStoreOptions = {
  homeDir?: string;
};

const CONFIG_DIRECTORY_SEGMENTS = [".config", "token-burner"];
const CONFIG_FILE_NAME = "config.json";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isLocalConfig = (value: unknown): value is LocalConfig => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.ownerToken === "string" &&
    value.ownerToken.length > 0 &&
    typeof value.humanId === "string" &&
    value.humanId.length > 0 &&
    typeof value.agentInstallationId === "string" &&
    value.agentInstallationId.length > 0 &&
    typeof value.baseUrl === "string" &&
    value.baseUrl.length > 0
  );
};

export const getLocalConfigPath = (options: LocalStoreOptions = {}) =>
  path.join(
    options.homeDir ?? homedir(),
    ...CONFIG_DIRECTORY_SEGMENTS,
    CONFIG_FILE_NAME,
  );

export const loadLocalConfig = async (
  options: LocalStoreOptions = {},
): Promise<LocalConfig | null> => {
  try {
    const rawConfig = await readFile(getLocalConfigPath(options), "utf8");
    const parsedConfig = JSON.parse(rawConfig) as unknown;

    if (!isLocalConfig(parsedConfig)) {
      throw new Error("Local token-burner config is invalid.");
    }

    return parsedConfig;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
};

export const saveLocalConfig = async (
  config: LocalConfig,
  options: LocalStoreOptions = {},
): Promise<void> => {
  const configPath = getLocalConfigPath(options);

  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
};

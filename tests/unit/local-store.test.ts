import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

type LocalConfigModule = {
  loadLocalConfig: (options?: { homeDir?: string }) => Promise<unknown>;
  saveLocalConfig: (
    config: Record<string, string>,
    options?: { homeDir?: string },
  ) => Promise<void>;
};

const importLocalStore = async (): Promise<LocalConfigModule> => {
  const module = await import(
    "../../packages/agent-cli/src/config/local-store"
  ).catch(() => null);

  expect(module).not.toBeNull();

  return module as LocalConfigModule;
};

describe("agent cli local store", () => {
  let tempHomeDir = "";

  beforeEach(async () => {
    tempHomeDir = await mkdtemp(path.join(os.tmpdir(), "token-burner-home-"));
  });

  afterEach(async () => {
    await rm(tempHomeDir, { force: true, recursive: true });
  });

  it("persists and loads the owner config under the token-burner config path", async () => {
    const localStore = await importLocalStore();
    const config = {
      agentInstallationId: "agent_456",
      baseUrl: "https://token-burner.test",
      humanId: "human_123",
      ownerToken: "tb_owner_123456",
    };

    await localStore.saveLocalConfig(config, { homeDir: tempHomeDir });

    expect(await localStore.loadLocalConfig({ homeDir: tempHomeDir })).toEqual(
      config,
    );

    const configPath = path.join(
      tempHomeDir,
      ".config",
      "token-burner",
      "config.json",
    );
    const savedConfig = JSON.parse(await readFile(configPath, "utf8"));

    expect(savedConfig).toEqual(config);
  });

  it("returns null when no local config is present", async () => {
    const localStore = await importLocalStore();

    expect(await localStore.loadLocalConfig({ homeDir: tempHomeDir })).toBeNull();
  });
});

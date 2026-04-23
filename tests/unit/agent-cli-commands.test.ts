import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runCli } from "../../packages/agent-cli/src/cli";
import { runLinkCommand } from "../../packages/agent-cli/src/commands/link";
import { runRegisterCommand } from "../../packages/agent-cli/src/commands/register";
import { runWhoamiCommand } from "../../packages/agent-cli/src/commands/whoami";
import { saveLocalConfig } from "../../packages/agent-cli/src/config/local-store";

type CapturedStreams = {
  stdout: string;
  stderr: string;
};

const captureStreams = () => {
  const stdoutStream = new PassThrough();
  const stderrStream = new PassThrough();
  const out: string[] = [];
  const err: string[] = [];
  stdoutStream.on("data", (chunk) => out.push(chunk.toString()));
  stderrStream.on("data", (chunk) => err.push(chunk.toString()));
  return {
    stdout: stdoutStream,
    stderr: stderrStream,
    collected: (): CapturedStreams => ({
      stdout: out.join(""),
      stderr: err.join(""),
    }),
  };
};

const captureProcessWrites = () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation(
    ((chunk: string | Uint8Array) => {
      stdout.push(typeof chunk === "string" ? chunk : chunk.toString());
      return true;
    }) as typeof process.stdout.write,
  );
  vi.spyOn(process.stderr, "write").mockImplementation(
    ((chunk: string | Uint8Array) => {
      stderr.push(typeof chunk === "string" ? chunk : chunk.toString());
      return true;
    }) as typeof process.stderr.write,
  );

  return {
    stdout: () => stdout.join(""),
    stderr: () => stderr.join(""),
  };
};

const buildRegisterResponse = () => ({
  humanId: "00000000-0000-0000-0000-000000000001",
  agentInstallationId: "00000000-0000-0000-0000-000000000002",
  ownerToken: "tb_owner_abcdef0123456789",
  handle: "alembic",
  avatar: "X",
});

const buildLinkResponse = () => ({
  humanId: "00000000-0000-0000-0000-000000000001",
  agentInstallationId: "00000000-0000-0000-0000-000000000099",
  handle: "alembic",
  avatar: "X",
});

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("agent cli register command", () => {
  let homeDir = "";

  beforeEach(async () => {
    homeDir = await mkdtemp(path.join(os.tmpdir(), "token-burner-cli-"));
  });

  afterEach(async () => {
    await rm(homeDir, { force: true, recursive: true });
    vi.restoreAllMocks();
  });

  it("calls the register endpoint and saves the owner token locally", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(201, buildRegisterResponse()));
    const streams = captureStreams();

    const exitCode = await runRegisterCommand({
      args: [
        "--claim-code",
        "ABCD1234",
        "--handle",
        "alembic",
        "--avatar",
        "X",
        "--agent-label",
        "claude-code@laptop",
        "--base-url",
        "https://token-burner.test",
      ],
      io: { stdout: streams.stdout, stderr: streams.stderr },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      homeDir,
    });

    expect(exitCode).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://token-burner.test/api/agent/register");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      claimCode: "ABCD1234",
      publicHandle: "alembic",
      avatar: "X",
      agentLabel: "claude-code@laptop",
    });

    const stored = JSON.parse(
      await readFile(
        path.join(homeDir, ".config", "token-burner", "config.json"),
        "utf8",
      ),
    );
    expect(stored).toEqual({
      humanId: "00000000-0000-0000-0000-000000000001",
      agentInstallationId: "00000000-0000-0000-0000-000000000002",
      ownerToken: "tb_owner_abcdef0123456789",
      baseUrl: "https://token-burner.test",
      publicHandle: "alembic",
      avatar: "X",
    });

    expect(streams.collected().stdout).toContain("registered as alembic");
  });

  it("returns an argument error when a required flag is missing", async () => {
    const streams = captureStreams();

    const exitCode = await runRegisterCommand({
      args: ["--claim-code", "ABCD1234"],
      io: { stdout: streams.stdout, stderr: streams.stderr },
      homeDir,
    });

    expect(exitCode).toBe(2);
    expect(streams.collected().stderr).toContain("missing required flag");
  });

  it("surfaces API errors with the server message", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse(409, { error: "claim code is invalid, expired, or already claimed" }),
      );
    const streams = captureStreams();

    const exitCode = await runRegisterCommand({
      args: [
        "--claim-code",
        "EXPIRED0",
        "--handle",
        "x",
        "--avatar",
        "x",
        "--agent-label",
        "x",
        "--base-url",
        "https://token-burner.test",
      ],
      io: { stdout: streams.stdout, stderr: streams.stderr },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      homeDir,
    });

    expect(exitCode).toBe(1);
    expect(streams.collected().stderr).toContain("claim code is invalid");
  });
});

describe("agent cli link command", () => {
  let homeDir = "";

  beforeEach(async () => {
    homeDir = await mkdtemp(path.join(os.tmpdir(), "token-burner-cli-"));
  });

  afterEach(async () => {
    await rm(homeDir, { force: true, recursive: true });
    vi.restoreAllMocks();
  });

  it("links a new installation using the stored owner token", async () => {
    await saveLocalConfig(
      {
        humanId: "00000000-0000-0000-0000-000000000001",
        agentInstallationId: "00000000-0000-0000-0000-000000000002",
        ownerToken: "tb_owner_deadbeef",
        baseUrl: "https://token-burner.test",
      },
      { homeDir },
    );
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(201, buildLinkResponse()));
    const streams = captureStreams();

    const exitCode = await runLinkCommand({
      args: ["--agent-label", "codex@desktop"],
      io: { stdout: streams.stdout, stderr: streams.stderr },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      homeDir,
    });

    expect(exitCode).toBe(0);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://token-burner.test/api/agent/link");
    expect(JSON.parse(init.body as string)).toEqual({
      ownerToken: "tb_owner_deadbeef",
      agentLabel: "codex@desktop",
    });

    const stored = JSON.parse(
      await readFile(
        path.join(homeDir, ".config", "token-burner", "config.json"),
        "utf8",
      ),
    );
    expect(stored.agentInstallationId).toBe(
      "00000000-0000-0000-0000-000000000099",
    );
    expect(stored.ownerToken).toBe("tb_owner_deadbeef");
    expect(stored.publicHandle).toBe("alembic");
    expect(stored.avatar).toBe("X");
  });

  it("refuses to link without an owner token", async () => {
    const streams = captureStreams();

    const exitCode = await runLinkCommand({
      args: ["--agent-label", "x"],
      io: { stdout: streams.stdout, stderr: streams.stderr },
      homeDir,
    });

    expect(exitCode).toBe(1);
    expect(streams.collected().stderr).toContain("no local owner token");
  });
});

describe("agent cli whoami command", () => {
  let homeDir = "";

  beforeEach(async () => {
    homeDir = await mkdtemp(path.join(os.tmpdir(), "token-burner-cli-"));
  });

  afterEach(async () => {
    await rm(homeDir, { force: true, recursive: true });
  });

  it("prints the persisted identity with a redacted owner token", async () => {
    await saveLocalConfig(
      {
        humanId: "human-123",
        agentInstallationId: "install-456",
        ownerToken: "tb_owner_deadbeefcafebabe1234",
        baseUrl: "https://token-burner.test",
        publicHandle: "alembic",
        avatar: "X",
      },
      { homeDir },
    );
    const streams = captureStreams();

    const exitCode = await runWhoamiCommand({
      io: { stdout: streams.stdout, stderr: streams.stderr },
      homeDir,
    });

    expect(exitCode).toBe(0);
    const out = streams.collected().stdout;
    expect(out).toContain("alembic");
    expect(out).toContain("human-123");
    expect(out).toContain("install-456");
    expect(out).toContain("tb_owner_dea");
    expect(out).not.toContain("tb_owner_deadbeefcafebabe1234");
  });

  it("exits non-zero when no local config exists", async () => {
    const streams = captureStreams();

    const exitCode = await runWhoamiCommand({
      io: { stdout: streams.stdout, stderr: streams.stderr },
      homeDir,
    });

    expect(exitCode).toBe(1);
    expect(streams.collected().stderr).toContain("no local token-burner config");
  });
});

describe("agent cli top-level help", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints detailed burn help with provider and target or preset usage", async () => {
    const writes = captureProcessWrites();

    const exitCode = await runCli(["burn", "--help"]);

    expect(exitCode).toBe(0);
    expect(writes.stdout()).toContain(
      "token-burner burn --provider <openai|anthropic> (--target N | --preset tier-1|tier-2|tier-3) [--model ID] [--api-key KEY] [--base-url URL]",
    );
    expect(writes.stdout()).toContain("Use exactly one of --target or --preset.");
    expect(writes.stdout()).toContain("tier-1 Amuse-Bouche");
    expect(writes.stderr()).toBe("");
  });
});

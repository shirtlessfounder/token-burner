import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { computeSafeRequest } from "../../packages/agent-cli/src/runtime/compute-safe-request";
import {
  ProviderCredentialsMissingError,
  type ProviderAdapter,
  type ProviderCredentials,
} from "../../packages/agent-cli/src/providers/types";
import { resolveProviderCredentials } from "../../packages/agent-cli/src/providers/resolve-credentials";
import { runBurnCommand } from "../../packages/agent-cli/src/commands/burn";
import { saveLocalConfig } from "../../packages/agent-cli/src/config/local-store";

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

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
    collected: () => ({ stdout: out.join(""), stderr: err.join("") }),
  };
};

const buildFakeAdapter = (perCall: { input: number; output: number }): ProviderAdapter => ({
  providerId: "anthropic",
  model: "claude-opus-4-7",
  runBurnStep: async () => ({
    inputTokens: perCall.input,
    outputTokens: perCall.output,
    totalBilledTokens: perCall.input + perCall.output,
    stopReason: "end_turn",
  }),
});

describe("computeSafeRequest", () => {
  it("returns a request sized under the remaining budget", () => {
    expect(computeSafeRequest(10_000)).toEqual({
      kind: "request",
      maxOutputTokens: expect.any(Number),
    });
    const decision = computeSafeRequest(10_000);
    expect(decision.kind).toBe("request");
    if (decision.kind === "request") {
      expect(decision.maxOutputTokens).toBeLessThanOrEqual(10_000 - 64 - 32);
    }
  });

  it("stops when the remaining budget is below the minimum step", () => {
    const decision = computeSafeRequest(100);
    expect(decision.kind).toBe("stop");
  });

  it("caps max tokens at 4096 even when budget is large", () => {
    const decision = computeSafeRequest(100_000);
    if (decision.kind !== "request") {
      throw new Error("expected request decision");
    }
    expect(decision.maxOutputTokens).toBe(4_096);
  });
});

describe("resolveProviderCredentials", () => {
  it("reads ANTHROPIC_API_KEY from env", () => {
    const result = resolveProviderCredentials("anthropic", {
      ANTHROPIC_API_KEY: "sk-ant-test",
    });
    expect(result.apiKey).toBe("sk-ant-test");
  });

  it("throws ProviderCredentialsMissingError when key is absent", () => {
    expect(() => resolveProviderCredentials("anthropic", {})).toThrow(
      ProviderCredentialsMissingError,
    );
  });

  it("ignores empty strings", () => {
    expect(() =>
      resolveProviderCredentials("openai", { OPENAI_API_KEY: "   " }),
    ).toThrow(ProviderCredentialsMissingError);
  });
});

describe("runBurnCommand", () => {
  let homeDir = "";

  beforeEach(async () => {
    homeDir = await mkdtemp(path.join(os.tmpdir(), "token-burner-burn-"));
  });

  afterEach(async () => {
    await rm(homeDir, { force: true, recursive: true });
    vi.restoreAllMocks();
  });

  const seedConfig = () =>
    saveLocalConfig(
      {
        humanId: "00000000-0000-0000-0000-000000000001",
        agentInstallationId: "00000000-0000-0000-0000-000000000002",
        ownerToken: "tb_owner_deadbeef",
        baseUrl: "https://token-burner.test",
      },
      { homeDir },
    );

  it("runs a full burn loop, posts heartbeats + events, and finishes completed", async () => {
    await seedConfig();
    const fetchCalls: Array<{ url: string; body: unknown }> = [];
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async (url, init) => {
        const body = init?.body ? JSON.parse(init.body as string) : null;
        fetchCalls.push({ url: url.toString(), body });
        if (url.toString().endsWith("/api/burns/start")) {
          return jsonResponse(201, {
            burnId: "burn-1",
            burnSessionToken: "tb_burn_deadbeef",
            status: "running",
          });
        }
        if (url.toString().includes("/heartbeat")) {
          return jsonResponse(200, {
            ok: true,
            status: "running",
            billedTokensConsumed: body.billedTokensConsumed,
          });
        }
        if (url.toString().includes("/events")) {
          return jsonResponse(201, { accepted: true });
        }
        if (url.toString().includes("/finish")) {
          return jsonResponse(200, { ok: true, status: body.status });
        }
        throw new Error(`unexpected fetch to ${url}`);
      });
    const streams = captureStreams();

    const exitCode = await runBurnCommand({
      args: [
        "--provider",
        "anthropic",
        "--target",
        "500",
        "--base-url",
        "https://token-burner.test",
      ],
      io: { stdout: streams.stdout, stderr: streams.stderr },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      homeDir,
      credentialsResolver: () => ({ providerId: "anthropic", apiKey: "sk-ant-test" }),
      adapterFactory: () => buildFakeAdapter({ input: 50, output: 150 }),
      disableParentWatch: true,
    });

    expect(exitCode).toBe(0);
    const urls = fetchCalls.map((call) => call.url);
    expect(urls).toEqual(
      expect.arrayContaining([
        "https://token-burner.test/api/burns/start",
        "https://token-burner.test/api/burns/burn-1/heartbeat",
        "https://token-burner.test/api/burns/burn-1/events",
        "https://token-burner.test/api/burns/burn-1/finish",
      ]),
    );

    const finishCall = fetchCalls.find((call) => call.url.endsWith("/finish"));
    expect(finishCall?.body).toMatchObject({ status: "completed" });
    expect(streams.collected().stdout).toContain("burn completed");
  });

  it("exits with code 2 when a required flag is missing", async () => {
    await seedConfig();
    const streams = captureStreams();

    const exitCode = await runBurnCommand({
      args: ["--provider", "anthropic"],
      io: { stdout: streams.stdout, stderr: streams.stderr },
      homeDir,
      disableParentWatch: true,
    });

    expect(exitCode).toBe(2);
    expect(streams.collected().stderr).toContain("missing required flag");
  });

  it("refuses to burn when no local config exists", async () => {
    const streams = captureStreams();

    const exitCode = await runBurnCommand({
      args: ["--provider", "anthropic", "--target", "100"],
      io: { stdout: streams.stdout, stderr: streams.stderr },
      homeDir,
      credentialsResolver: () => ({ providerId: "anthropic", apiKey: "k" }),
      adapterFactory: () => buildFakeAdapter({ input: 1, output: 1 }),
      disableParentWatch: true,
    });

    expect(exitCode).toBe(1);
    expect(streams.collected().stderr).toContain(
      "no local token-burner config",
    );
  });

  it("reports missing provider credentials and exits", async () => {
    await seedConfig();
    const streams = captureStreams();

    const exitCode = await runBurnCommand({
      args: ["--provider", "anthropic", "--target", "100"],
      io: { stdout: streams.stdout, stderr: streams.stderr },
      homeDir,
      credentialsResolver: () => {
        throw new ProviderCredentialsMissingError("anthropic");
      },
      adapterFactory: () => {
        throw new Error("should not be called");
      },
      disableParentWatch: true,
    });

    expect(exitCode).toBe(1);
    expect(streams.collected().stderr).toContain("no local anthropic credentials");
  });
});

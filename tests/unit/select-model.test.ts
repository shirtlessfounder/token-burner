import { describe, expect, it, vi } from "vitest";

import {
  NoAvailableModelError,
  selectAvailableModel,
} from "../../packages/agent-cli/src/providers/select-model";
import type { ProviderAdapter } from "../../packages/agent-cli/src/providers/types";

const buildAdapter = (
  model: string,
  runBurnStep: ProviderAdapter["runBurnStep"],
): ProviderAdapter => ({
  providerId: "openai",
  model,
  runBurnStep,
});

const httpError = (status: number) => Object.assign(new Error("upstream"), {
  status,
});

describe("selectAvailableModel", () => {
  it("returns the requested model verbatim, no probing", async () => {
    const factory = vi.fn();
    const result = await selectAvailableModel({
      credentials: { providerId: "openai", apiKey: "sk-test" },
      requestedModel: "gpt-explicit",
      adapterFactory: factory,
    });
    expect(result).toBe("gpt-explicit");
    expect(factory).not.toHaveBeenCalled();
  });

  it("returns the first model in the fallback chain that does not 403/404", async () => {
    let callIndex = 0;
    const factory = vi.fn(
      (_creds, model: string): ProviderAdapter =>
        buildAdapter(model, async () => {
          callIndex += 1;
          if (callIndex === 1) throw httpError(403);
          if (callIndex === 2) throw httpError(404);
          return {
            inputTokens: 1,
            outputTokens: 1,
            totalBilledTokens: 2,
            stopReason: null,
          };
        }),
    );

    const result = await selectAvailableModel({
      credentials: { providerId: "openai", apiKey: "sk-test" },
      adapterFactory: factory,
    });

    expect(result).toBe("gpt-4o");
    expect(factory).toHaveBeenCalledTimes(3);
  });

  it("rethrows a non-availability error so we don't burn the chain on auth failures", async () => {
    const factory = vi.fn((_creds, model: string): ProviderAdapter =>
      buildAdapter(model, async () => {
        throw httpError(401);
      }),
    );

    await expect(
      selectAvailableModel({
        credentials: { providerId: "openai", apiKey: "sk-test" },
        adapterFactory: factory,
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("throws NoAvailableModelError when every fallback 403/404s", async () => {
    const factory = vi.fn((_creds, model: string): ProviderAdapter =>
      buildAdapter(model, async () => {
        throw httpError(403);
      }),
    );

    await expect(
      selectAvailableModel({
        credentials: { providerId: "anthropic", apiKey: "sk-ant-test" },
        adapterFactory: factory,
      }),
    ).rejects.toBeInstanceOf(NoAvailableModelError);
  });
});

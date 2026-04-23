import { describe, expect, it } from "vitest";

import {
  ProviderKeyFormatError,
  validateProviderKeyFormat,
} from "../../packages/agent-cli/src/providers/key-format";

describe("validateProviderKeyFormat", () => {
  it("accepts real openai keys", () => {
    expect(() =>
      validateProviderKeyFormat("openai", "sk-proj-abc123"),
    ).not.toThrow();
    expect(() =>
      validateProviderKeyFormat("openai", "sk-svcacct-xyz"),
    ).not.toThrow();
  });

  it("accepts real anthropic keys", () => {
    expect(() =>
      validateProviderKeyFormat("anthropic", "sk-ant-api03-abc"),
    ).not.toThrow();
  });

  it("accepts innies keys for either provider", () => {
    expect(() =>
      validateProviderKeyFormat("openai", "in_live_abc123"),
    ).not.toThrow();
    expect(() =>
      validateProviderKeyFormat("anthropic", "in_live_abc123"),
    ).not.toThrow();
    expect(() =>
      validateProviderKeyFormat("openai", "in_test_abc123"),
    ).not.toThrow();
  });

  it("rejects an anthropic-shaped key in the openai slot", () => {
    expect(() =>
      validateProviderKeyFormat("openai", "sk-ant-api03-abc"),
    ).toThrow(ProviderKeyFormatError);
  });

  it("rejects an openai-shaped key in the anthropic slot", () => {
    expect(() =>
      validateProviderKeyFormat("anthropic", "sk-proj-abc123"),
    ).toThrow(ProviderKeyFormatError);
  });

  it("rejects garbage", () => {
    expect(() => validateProviderKeyFormat("openai", "hunter2")).toThrow(
      ProviderKeyFormatError,
    );
  });
});

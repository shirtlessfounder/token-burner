import { describe, expect, it } from "vitest";

import {
  isInniesKey,
  resolveInniesProxyBaseUrl,
} from "../../packages/agent-cli/src/providers/innies";

describe("innies key detection", () => {
  it("recognizes live and test prefixes", () => {
    expect(isInniesKey("in_live_abcdef")).toBe(true);
    expect(isInniesKey("in_test_abcdef")).toBe(true);
  });

  it("rejects real openai and anthropic prefixes", () => {
    expect(isInniesKey("sk-proj-deadbeef")).toBe(false);
    expect(isInniesKey("sk-ant-api03-xyz")).toBe(false);
  });
});

describe("innies proxy base url", () => {
  it("routes openai through the chat/completions-friendly prefix", () => {
    expect(resolveInniesProxyBaseUrl("openai", {})).toBe(
      "https://api.innies.computer/v1/proxy/v1",
    );
  });

  it("routes anthropic so the sdk can append /v1/messages", () => {
    expect(resolveInniesProxyBaseUrl("anthropic", {})).toBe(
      "https://api.innies.computer/v1/proxy",
    );
  });

  it("honors INNIES_BASE_URL override and trims trailing slash", () => {
    expect(
      resolveInniesProxyBaseUrl("openai", {
        INNIES_BASE_URL: "https://innies.test/",
      }),
    ).toBe("https://innies.test/v1/proxy/v1");
  });
});

import { describe, expect, it } from "vitest";

import {
  burnStatusValues,
  parseBurnFinishRequest,
  parseBurnStartRequest,
  parseClaimCodeResponse,
  parseHeartbeatRequest,
  parseLinkResponse,
  parseRegisterResponse,
  parseTelemetryEventRequest,
  presetIdValues,
  providerValues,
} from "../../packages/shared/src";

describe("shared api contracts", () => {
  it("parses claim code and identity responses", () => {
    expect(
      parseClaimCodeResponse({
        code: "ABC123",
        expiresAt: "2026-04-21T00:00:00Z",
      }),
    ).toMatchObject({
      code: "ABC123",
      expiresAt: "2026-04-21T00:00:00Z",
    });

    expect(
      parseRegisterResponse({
        humanId: "human_123",
        agentInstallationId: "agent_456",
        ownerToken: "tb_owner_123456",
        handle: "burner",
        avatar: "🔥",
      }),
    ).toMatchObject({
      humanId: "human_123",
      agentInstallationId: "agent_456",
      ownerToken: "tb_owner_123456",
      handle: "burner",
      avatar: "🔥",
    });

    expect(
      parseLinkResponse({
        humanId: "human_123",
        agentInstallationId: "agent_789",
        handle: "burner",
        avatar: "🔥",
      }),
    ).toMatchObject({
      humanId: "human_123",
      agentInstallationId: "agent_789",
      handle: "burner",
      avatar: "🔥",
    });
  });

  it("validates burn start payloads", () => {
    expect(
      parseBurnStartRequest({
        ownerToken: "tb_owner_123456",
        provider: "openai",
        targetTokens: 500_000,
        presetId: "tier-2",
      }),
    ).toMatchObject({
      ownerToken: "tb_owner_123456",
      provider: "openai",
      targetTokens: 500_000,
      presetId: "tier-2",
    });

    expect(() =>
      parseBurnStartRequest({
        ownerToken: "tb_owner_123456",
        provider: "openai",
        targetTokens: 0,
        presetId: "tier-2",
      }),
    ).toThrow(/targetTokens/i);
  });

  it("accepts null or omitted burn preset ids", () => {
    expect(
      parseBurnStartRequest({
        ownerToken: "tb_owner_123456",
        provider: "openai",
        targetTokens: 500_000,
        presetId: null,
      }),
    ).toMatchObject({
      ownerToken: "tb_owner_123456",
      provider: "openai",
      targetTokens: 500_000,
      presetId: null,
    });

    expect(
      parseBurnStartRequest({
        ownerToken: "tb_owner_123456",
        provider: "openai",
        targetTokens: 500_000,
      }),
    ).toMatchObject({
      ownerToken: "tb_owner_123456",
      provider: "openai",
      targetTokens: 500_000,
    });
  });

  it("validates heartbeat, telemetry, and finish payloads", () => {
    expect(
      parseHeartbeatRequest({
        burnSessionToken: "tb_burn_123456",
        billedTokensConsumed: 2048,
      }),
    ).toMatchObject({
      burnSessionToken: "tb_burn_123456",
      billedTokensConsumed: 2048,
    });

    expect(
      parseTelemetryEventRequest({
        burnSessionToken: "tb_burn_123456",
        eventType: "provider-response",
        billedTokensConsumed: 2048,
        eventPayload: {
          billedTokens: 2048,
          step: 1,
        },
      }),
    ).toMatchObject({
      burnSessionToken: "tb_burn_123456",
      eventType: "provider-response",
      billedTokensConsumed: 2048,
      eventPayload: {
        billedTokens: 2048,
        step: 1,
      },
    });

    expect(
      parseBurnFinishRequest({
        burnSessionToken: "tb_burn_123456",
        status: "completed",
        billedTokensConsumed: 4096,
      }),
    ).toMatchObject({
      burnSessionToken: "tb_burn_123456",
      status: "completed",
      billedTokensConsumed: 4096,
    });
  });

  it("exports shared domain values", () => {
    expect(providerValues).toEqual(["openai", "anthropic"]);
    expect(burnStatusValues).toEqual([
      "queued",
      "running",
      "stopping",
      "completed",
      "interrupted",
      "failed",
    ]);
    expect(presetIdValues).toEqual(["tier-1", "tier-2", "tier-3"]);
  });
});

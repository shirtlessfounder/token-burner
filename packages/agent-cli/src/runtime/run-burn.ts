import { presetIdSchema, type PresetId, type ProviderId, type TerminalBurnStatus } from "@token-burner/shared";

import {
  ApiError,
  finishBurn as finishBurnApi,
  postBurnEvent,
  postHeartbeat,
  startBurn as startBurnApi,
  type ApiClientOptions,
} from "../api/client.js";
import type { ProviderAdapter } from "../providers/types.js";
import { computeSafeRequest } from "./compute-safe-request.js";
import { watchParent, type ParentWatchHandle } from "./parent-watch.js";

export type RunBurnOptions = {
  ownerToken: string;
  agentInstallationId: string;
  provider: ProviderId;
  targetTokens: number;
  presetId?: PresetId | string | null;
  adapter: ProviderAdapter;
  apiOptions: ApiClientOptions;
  onProgress?: (snapshot: BurnProgressSnapshot) => void;
  parentWatch?: {
    enabled?: boolean;
    pollIntervalMs?: number;
  };
};

export type BurnProgressSnapshot = {
  burnId: string;
  stepIndex: number;
  stepInputTokens: number;
  stepOutputTokens: number;
  totalBilledTokens: number;
  targetTokens: number;
};

export type RunBurnResult = {
  burnId: string;
  terminalStatus: TerminalBurnStatus;
  totalBilledTokens: number;
  steps: number;
  stopReason: string;
};

const clampBilled = (billed: number, target: number): number =>
  Math.max(0, Math.min(billed, target));

export const runBurn = async ({
  ownerToken,
  agentInstallationId,
  provider,
  targetTokens,
  presetId = null,
  adapter,
  apiOptions,
  onProgress,
  parentWatch,
}: RunBurnOptions): Promise<RunBurnResult> => {
  const started = await startBurnApi(
    {
      ownerToken,
      agentInstallationId,
      provider,
      targetTokens,
      presetId: presetId ? presetIdSchema.parse(presetId) : undefined,
    },
    apiOptions,
  );

  const burnId = started.burnId;
  const burnSessionToken = started.burnSessionToken;

  let terminalStatus: TerminalBurnStatus = "failed";
  let stopReason = "unknown";
  let totalBilledTokens = 0;
  let stepIndex = 0;
  let parentHandle: ParentWatchHandle | null = null;
  let parentExited = false;
  const signalHandlers: Array<{ signal: NodeJS.Signals; handler: () => void }> =
    [];

  const installSignal = (signal: NodeJS.Signals) => {
    const handler = () => {
      parentExited = true;
      stopReason = `received ${signal}`;
    };
    process.on(signal, handler);
    signalHandlers.push({ signal, handler });
  };

  const uninstallSignals = () => {
    for (const { signal, handler } of signalHandlers) {
      process.off(signal, handler);
    }
  };

  installSignal("SIGINT");
  installSignal("SIGTERM");
  installSignal("SIGHUP");

  if (parentWatch?.enabled !== false) {
    parentHandle = watchParent(
      () => {
        parentExited = true;
        stopReason = "parent session ended";
      },
      { pollIntervalMs: parentWatch?.pollIntervalMs },
    );
  }

  try {
    while (true) {
      if (parentExited) {
        terminalStatus = "interrupted";
        break;
      }

      const remaining = targetTokens - totalBilledTokens;
      const decision = computeSafeRequest(remaining);
      if (decision.kind === "stop") {
        terminalStatus = "completed";
        stopReason = decision.reason;
        break;
      }

      let stepResult;
      try {
        stepResult = await adapter.runBurnStep({
          maxOutputTokens: decision.maxOutputTokens,
        });
      } catch (error) {
        terminalStatus = "failed";
        stopReason =
          error instanceof Error
            ? `provider error: ${error.message}`
            : "provider error";
        break;
      }

      stepIndex += 1;
      totalBilledTokens = clampBilled(
        totalBilledTokens + stepResult.totalBilledTokens,
        targetTokens,
      );

      onProgress?.({
        burnId,
        stepIndex,
        stepInputTokens: stepResult.inputTokens,
        stepOutputTokens: stepResult.outputTokens,
        totalBilledTokens,
        targetTokens,
      });

      await postHeartbeat(
        burnId,
        { burnSessionToken, billedTokensConsumed: totalBilledTokens },
        apiOptions,
      );

      await postBurnEvent(
        burnId,
        {
          burnSessionToken,
          eventType: "step",
          billedTokensConsumed: totalBilledTokens,
          eventPayload: {
            stepIndex,
            inputTokens: stepResult.inputTokens,
            outputTokens: stepResult.outputTokens,
            stopReason: stepResult.stopReason,
            model: adapter.model,
          },
        },
        apiOptions,
      );

      if (totalBilledTokens >= targetTokens) {
        terminalStatus = "completed";
        stopReason = "reached target";
        break;
      }
    }
  } finally {
    try {
      await finishBurnApi(
        burnId,
        {
          burnSessionToken,
          status: terminalStatus,
          billedTokensConsumed: totalBilledTokens,
        },
        apiOptions,
      );
    } catch (error) {
      if (!(error instanceof ApiError)) {
        throw error;
      }
    }
    parentHandle?.stop();
    uninstallSignals();
  }

  return {
    burnId,
    terminalStatus,
    totalBilledTokens,
    steps: stepIndex,
    stopReason,
  };
};

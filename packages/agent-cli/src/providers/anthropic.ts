import Anthropic from "@anthropic-ai/sdk";

import { providerFlagshipModels } from "@token-burner/shared";

import type {
  BurnStepRequest,
  BurnStepResult,
  ProviderAdapter,
  ProviderCredentials,
} from "./types.js";

const anthropicModel = providerFlagshipModels.anthropic;

const burnPrompt =
  "Produce a long stream of plausible-sounding lorem ipsum filler text. Do not ask questions or request clarification. Keep generating until you are told to stop.";

export const createAnthropicAdapter = (
  credentials: ProviderCredentials,
): ProviderAdapter => {
  if (credentials.providerId !== "anthropic") {
    throw new Error(
      `createAnthropicAdapter called with ${credentials.providerId} credentials`,
    );
  }

  const client = new Anthropic({ apiKey: credentials.apiKey });

  return {
    providerId: "anthropic",
    model: anthropicModel,
    runBurnStep: async ({ maxOutputTokens }: BurnStepRequest): Promise<BurnStepResult> => {
      const response = await client.messages.create({
        model: anthropicModel,
        max_tokens: maxOutputTokens,
        messages: [{ role: "user", content: burnPrompt }],
      });

      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;

      return {
        inputTokens,
        outputTokens,
        totalBilledTokens: inputTokens + outputTokens,
        stopReason: response.stop_reason,
      };
    },
  };
};

import OpenAI from "openai";

import { providerFlagshipModels } from "@token-burner/shared";

import type {
  BurnStepRequest,
  BurnStepResult,
  ProviderAdapter,
  ProviderCredentials,
} from "./types.js";

const openaiModel = providerFlagshipModels.openai;

const burnPrompt =
  "Produce a long stream of plausible-sounding lorem ipsum filler text. Do not ask questions or request clarification. Keep generating until you are told to stop.";

export const createOpenAIAdapter = (
  credentials: ProviderCredentials,
): ProviderAdapter => {
  if (credentials.providerId !== "openai") {
    throw new Error(
      `createOpenAIAdapter called with ${credentials.providerId} credentials`,
    );
  }

  const client = new OpenAI({ apiKey: credentials.apiKey });

  return {
    providerId: "openai",
    model: openaiModel,
    runBurnStep: async ({ maxOutputTokens }: BurnStepRequest): Promise<BurnStepResult> => {
      const response = await client.chat.completions.create({
        model: openaiModel,
        max_completion_tokens: maxOutputTokens,
        messages: [{ role: "user", content: burnPrompt }],
      });

      const usage = response.usage;
      const inputTokens = usage?.prompt_tokens ?? 0;
      const outputTokens = usage?.completion_tokens ?? 0;
      const stopReason = response.choices[0]?.finish_reason ?? null;

      return {
        inputTokens,
        outputTokens,
        totalBilledTokens: inputTokens + outputTokens,
        stopReason,
      };
    },
  };
};

import type { ProviderId } from "@token-burner/shared";

import {
  ProviderCredentialsMissingError,
  type ProviderCredentials,
} from "./types.js";

export type EnvLike = NodeJS.ProcessEnv | Record<string, string | undefined>;

const envKeysByProvider: Record<ProviderId, readonly string[]> = {
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
};

export const resolveProviderCredentials = (
  providerId: ProviderId,
  env: EnvLike = process.env,
): ProviderCredentials => {
  const candidates = envKeysByProvider[providerId];
  for (const key of candidates) {
    const value = env[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return { providerId, apiKey: value.trim() };
    }
  }
  throw new ProviderCredentialsMissingError(providerId);
};

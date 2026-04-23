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

export type ResolveProviderCredentialsOptions = {
  apiKeyOverride?: string;
};

export const resolveProviderCredentials = (
  providerId: ProviderId,
  env: EnvLike = process.env,
  { apiKeyOverride }: ResolveProviderCredentialsOptions = {},
): ProviderCredentials => {
  if (apiKeyOverride && apiKeyOverride.trim().length > 0) {
    return { providerId, apiKey: apiKeyOverride.trim() };
  }

  const candidates = envKeysByProvider[providerId];
  for (const key of candidates) {
    const value = env[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return { providerId, apiKey: value.trim() };
    }
  }
  throw new ProviderCredentialsMissingError(providerId);
};

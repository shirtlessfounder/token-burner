import { providerModelFallbacks, type ProviderId } from "@token-burner/shared";

import type { ProviderAdapter, ProviderCredentials } from "./types.js";

export type AdapterFactory = (
  credentials: ProviderCredentials,
  model: string,
) => ProviderAdapter;

const isModelAvailabilityError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const status = (error as { status?: unknown }).status;
  return status === 403 || status === 404;
};

export class NoAvailableModelError extends Error {
  readonly tried: readonly string[];
  readonly lastError: unknown;

  constructor(provider: ProviderId, tried: readonly string[], lastError: unknown) {
    super(
      `no ${provider} model from this account's allowlist worked. tried: ${tried.join(", ")}. pass --model <id> with one your account can call.`,
    );
    this.name = "NoAvailableModelError";
    this.tried = tried;
    this.lastError = lastError;
  }
}

// Picks a model the credentials can actually call. If `requestedModel` is
// passed, returns it without probing — explicit user choice wins. Otherwise
// probes the fallback chain for the provider with a 1-token request and
// returns the first model that doesn't 403/404.
export const selectAvailableModel = async ({
  credentials,
  requestedModel,
  adapterFactory,
}: {
  credentials: ProviderCredentials;
  requestedModel?: string;
  adapterFactory: AdapterFactory;
}): Promise<string> => {
  if (requestedModel) {
    return requestedModel;
  }

  const candidates = providerModelFallbacks[credentials.providerId];
  let lastError: unknown = null;

  for (const candidate of candidates) {
    const adapter = adapterFactory(credentials, candidate);
    try {
      await adapter.runBurnStep({ maxOutputTokens: 1 });
      return candidate;
    } catch (error) {
      lastError = error;
      if (!isModelAvailabilityError(error)) {
        throw error;
      }
    }
  }

  throw new NoAvailableModelError(
    credentials.providerId,
    candidates,
    lastError,
  );
};

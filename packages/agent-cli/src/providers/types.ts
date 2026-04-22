import type { ProviderId } from "@token-burner/shared";

export type BurnStepResult = {
  inputTokens: number;
  outputTokens: number;
  totalBilledTokens: number;
  stopReason: string | null;
};

export type BurnStepRequest = {
  maxOutputTokens: number;
};

export type ProviderAdapter = {
  providerId: ProviderId;
  model: string;
  runBurnStep: (request: BurnStepRequest) => Promise<BurnStepResult>;
};

export type ProviderCredentials = {
  providerId: ProviderId;
  apiKey: string;
};

export class ProviderCredentialsMissingError extends Error {
  constructor(providerId: ProviderId) {
    super(
      `no local ${providerId} credentials found. token-burner only uses official provider credentials from your environment.`,
    );
    this.name = "ProviderCredentialsMissingError";
  }
}

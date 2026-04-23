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
    const envVar =
      providerId === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
    super(
      [
        `no local ${providerId} credentials found.`,
        `token-burner reads ${envVar} from your shell environment.`,
        ``,
        `if you launched this from a cli agent (claude code, codex, cursor, etc.):`,
        `most agents do NOT pass their own provider auth to spawned subprocesses,`,
        `so ${envVar} can be empty inside Bash/npx even while the agent is talking`,
        `to ${providerId}. either:`,
        `  (a) set ${envVar} in your shell BEFORE launching the agent, then restart it, or`,
        `  (b) pass the key explicitly: token-burner burn --api-key <KEY> ...`,
      ].join("\n"),
    );
    this.name = "ProviderCredentialsMissingError";
  }
}

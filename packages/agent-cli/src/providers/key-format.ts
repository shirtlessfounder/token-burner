import type { ProviderId } from "@token-burner/shared";

import { isInniesKey } from "./innies.js";

export class ProviderKeyFormatError extends Error {
  readonly providerId: ProviderId;

  constructor(providerId: ProviderId, apiKey: string) {
    const expected =
      providerId === "openai"
        ? '"sk-..." (or "in_live_..." / "in_test_..." for innies)'
        : '"sk-ant-..." (or "in_live_..." / "in_test_..." for innies)';
    const envVar =
      providerId === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
    const preview = apiKey.slice(0, 8);
    super(
      [
        `${providerId} key format looks wrong.`,
        `${envVar} (or --api-key) should start with ${expected}; yours starts with "${preview}".`,
        `did you put a key for the other provider in the wrong slot?`,
      ].join("\n"),
    );
    this.name = "ProviderKeyFormatError";
    this.providerId = providerId;
  }
}

export const validateProviderKeyFormat = (
  providerId: ProviderId,
  apiKey: string,
): void => {
  if (isInniesKey(apiKey)) {
    return;
  }
  if (providerId === "openai") {
    if (!apiKey.startsWith("sk-") || apiKey.startsWith("sk-ant-")) {
      throw new ProviderKeyFormatError(providerId, apiKey);
    }
  }
  if (providerId === "anthropic" && !apiKey.startsWith("sk-ant-")) {
    throw new ProviderKeyFormatError(providerId, apiKey);
  }
};

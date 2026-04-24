import "server-only";

import { getEncoding, type Tiktoken } from "js-tiktoken";

import type { ProviderId } from "@token-burner/shared";

// Both providers use a single tokenizer for verification.
//
// For openai content, o200k_base is exact (matches gpt-4o / gpt-5 / gpt-5.4).
// For anthropic content, no pure-JS Claude tokenizer exists — Anthropic's
// own @anthropic-ai/tokenizer package depends on tiktoken's wasm build,
// which Next.js bundling can't pick up cleanly. o200k_base is a close-enough
// approximation (typically within ~5-10% of Anthropic's billed count) and
// keeps the verification path purely JS / serverless-safe.
//
// What we're proving with this number isn't "your provider charged you
// exactly N tokens". It's "you actually generated N tokens worth of text",
// which kills the "type a big number" cheat path. That's the bar tier 1 is
// trying to clear.
let encoding: Tiktoken | null = null;
const getCoreEncoding = (): Tiktoken => {
  if (!encoding) {
    encoding = getEncoding("o200k_base");
  }
  return encoding;
};

export const countOutputTokens = (
  _provider: ProviderId,
  content: string,
): number => {
  if (!content) {
    return 0;
  }
  return getCoreEncoding().encode(content).length;
};

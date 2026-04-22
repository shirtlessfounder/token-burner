import { z } from "zod";

export const providerValues = ["openai", "anthropic"] as const;
export const providerSchema = z.enum(providerValues);
export type ProviderId = z.infer<typeof providerSchema>;

export const burnStatusValues = [
  "queued",
  "running",
  "stopping",
  "completed",
  "interrupted",
  "failed",
] as const;
export const burnStatusSchema = z.enum(burnStatusValues);
export type BurnStatus = z.infer<typeof burnStatusSchema>;

export const terminalBurnStatusValues = [
  "completed",
  "interrupted",
  "failed",
] as const;
export const terminalBurnStatusSchema = z.enum(terminalBurnStatusValues);
export type TerminalBurnStatus = z.infer<typeof terminalBurnStatusSchema>;

export const presetIdValues = ["tier-1", "tier-2", "tier-3"] as const;
export const presetIdSchema = z.enum(presetIdValues);
export type PresetId = z.infer<typeof presetIdSchema>;

export const providerFlagshipModels: Record<ProviderId, string> = {
  openai: "gpt-5.4",
  anthropic: "claude-opus-4-7",
};

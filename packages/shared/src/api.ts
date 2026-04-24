import { z } from "zod";

import {
  burnStatusSchema,
  presetIdSchema,
  providerSchema,
  terminalBurnStatusSchema,
} from "./domain.js";

const nonEmptyStringSchema = z.string().trim().min(1);
const isoDatetimeSchema = z.string().datetime({ offset: true });
const positiveTokenCountSchema = z.number().int().positive();
const ownerTokenSchema = z.string().regex(/^tb_owner_[A-Za-z0-9_]+$/);
const burnSessionTokenSchema = z.string().regex(/^tb_burn_[A-Za-z0-9_]+$/);

export const claimCodeResponseSchema = z.object({
  code: nonEmptyStringSchema,
  expiresAt: isoDatetimeSchema,
});
export type ClaimCodeResponse = z.infer<typeof claimCodeResponseSchema>;
export const parseClaimCodeResponse = (input: unknown): ClaimCodeResponse =>
  claimCodeResponseSchema.parse(input);

export const registerRequestSchema = z.object({
  claimCode: nonEmptyStringSchema,
  publicHandle: nonEmptyStringSchema,
  avatar: nonEmptyStringSchema,
  agentLabel: nonEmptyStringSchema,
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export const parseRegisterRequest = (input: unknown): RegisterRequest =>
  registerRequestSchema.parse(input);

export const registerResponseSchema = z.object({
  humanId: nonEmptyStringSchema,
  agentInstallationId: nonEmptyStringSchema,
  ownerToken: ownerTokenSchema,
  handle: nonEmptyStringSchema,
  avatar: nonEmptyStringSchema,
});
export type RegisterResponse = z.infer<typeof registerResponseSchema>;
export const parseRegisterResponse = (input: unknown): RegisterResponse =>
  registerResponseSchema.parse(input);

export const linkRequestSchema = z.object({
  ownerToken: ownerTokenSchema,
  agentLabel: nonEmptyStringSchema,
});
export type LinkRequest = z.infer<typeof linkRequestSchema>;
export const parseLinkRequest = (input: unknown): LinkRequest =>
  linkRequestSchema.parse(input);

export const linkResponseSchema = z.object({
  humanId: nonEmptyStringSchema,
  agentInstallationId: nonEmptyStringSchema,
  handle: nonEmptyStringSchema,
  avatar: nonEmptyStringSchema,
});
export type LinkResponse = z.infer<typeof linkResponseSchema>;
export const parseLinkResponse = (input: unknown): LinkResponse =>
  linkResponseSchema.parse(input);

export const burnStartRequestSchema = z.object({
  ownerToken: ownerTokenSchema,
  agentInstallationId: nonEmptyStringSchema,
  provider: providerSchema,
  targetTokens: positiveTokenCountSchema,
  presetId: presetIdSchema.nullish(),
});
export type BurnStartRequest = z.infer<typeof burnStartRequestSchema>;
export const parseBurnStartRequest = (input: unknown): BurnStartRequest =>
  burnStartRequestSchema.parse(input);

export const burnStartResponseSchema = z.object({
  burnId: nonEmptyStringSchema,
  burnSessionToken: burnSessionTokenSchema,
  status: burnStatusSchema,
});
export type BurnStartResponse = z.infer<typeof burnStartResponseSchema>;
export const parseBurnStartResponse = (input: unknown): BurnStartResponse =>
  burnStartResponseSchema.parse(input);

export const heartbeatRequestSchema = z.object({
  burnSessionToken: burnSessionTokenSchema,
  billedTokensConsumed: z.number().int().nonnegative(),
});
export type HeartbeatRequest = z.infer<typeof heartbeatRequestSchema>;
export const parseHeartbeatRequest = (input: unknown): HeartbeatRequest =>
  heartbeatRequestSchema.parse(input);

export const heartbeatResponseSchema = z.object({
  ok: z.boolean(),
  status: burnStatusSchema,
  billedTokensConsumed: z.number().int().nonnegative(),
});
export type HeartbeatResponse = z.infer<typeof heartbeatResponseSchema>;
export const parseHeartbeatResponse = (input: unknown): HeartbeatResponse =>
  heartbeatResponseSchema.parse(input);

export const telemetryEventRequestSchema = z.object({
  burnSessionToken: burnSessionTokenSchema,
  eventType: nonEmptyStringSchema,
  billedTokensConsumed: z.number().int().nonnegative().optional(),
  eventPayload: z.record(z.string(), z.unknown()),
});
export type TelemetryEventRequest = z.infer<typeof telemetryEventRequestSchema>;
export const parseTelemetryEventRequest = (
  input: unknown,
): TelemetryEventRequest => telemetryEventRequestSchema.parse(input);

export const telemetryEventResponseSchema = z.object({
  accepted: z.boolean(),
  verifiedStepTokens: z.number().int().nonnegative().optional(),
  cumulativeTokens: z.number().int().nonnegative(),
  verified: z.boolean(),
});
export type TelemetryEventResponse = z.infer<typeof telemetryEventResponseSchema>;
export const parseTelemetryEventResponse = (
  input: unknown,
): TelemetryEventResponse => telemetryEventResponseSchema.parse(input);

export const burnFinishRequestSchema = z.object({
  burnSessionToken: burnSessionTokenSchema,
  status: terminalBurnStatusSchema,
  billedTokensConsumed: z.number().int().nonnegative(),
});
export type BurnFinishRequest = z.infer<typeof burnFinishRequestSchema>;
export const parseBurnFinishRequest = (input: unknown): BurnFinishRequest =>
  burnFinishRequestSchema.parse(input);

export const burnFinishResponseSchema = z.object({
  ok: z.boolean(),
  status: terminalBurnStatusSchema,
});
export type BurnFinishResponse = z.infer<typeof burnFinishResponseSchema>;
export const parseBurnFinishResponse = (input: unknown): BurnFinishResponse =>
  burnFinishResponseSchema.parse(input);

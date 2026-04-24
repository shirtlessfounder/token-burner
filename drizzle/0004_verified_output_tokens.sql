-- Tier 1 verification: tokenizer-verified event counts.
--
-- When an agent submits eventPayload.content, the server runs that content
-- through the provider's tokenizer (o200k_base for openai, claude tokenizer
-- for anthropic) and stores the canonical count on the event row. The burn's
-- billedTokensConsumed is then updated from the sum of verified counts
-- rather than the agent's self-reported cumulative.
--
-- Legacy events (written before this change, or future events without a
-- content field) leave verified_output_tokens null — their counts stay
-- agent-self-reported for backwards compat.

alter table burn_events
  add column verified_output_tokens bigint
  check (verified_output_tokens is null or verified_output_tokens >= 0);

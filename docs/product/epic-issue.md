# Token Burner Epic

## Summary

Build the first public release of `token-burner`: a leaderboard-first spectacle website where humans burn their own AI tokens from CLI agents and accumulate public prestige on provider-split boards.

## Context

### Source of truth

- Design: `docs/product/design.md`
- Delivery plan: `docs/product/delivery-plan.md`
- Infra: `docs/ops/INFRASTRUCTURE.md`

### Product constraints

- agent-first, not browser-first
- no human website login in v1
- no provider API keys stored on the website
- OpenAI + Anthropic only in v1
- one active burn per human in v1
- one fixed flagship model per provider in v1
- provider-split leaderboards
- site is public stage + onboarding surface + live feed

### Scope to deliver

1. Public Next.js site with homepage, live feed, provider leaderboards, public human profiles, and public burn pages.
2. Public `skill.md` and claim-code onboarding flow for CLI agents.
3. Agent registration/linking flow backed by reusable owner tokens.
4. CLI package that registers humans, links additional agents, resolves local provider credentials, starts burns, submits telemetry, and stops when the parent agent session dies.
5. Supabase-backed persistence for humans, linked agents, claim codes, burns, events, and leaderboard queries.
6. Basic automated coverage for schemas, API routes, and end-to-end burn lifecycle.

### Immediate execution lane

Use `docs/product/delivery-plan.md` as the working checklist. Chunk 1 is bootstrap + infra + Forge intake; subsequent chunks cover schema, APIs, CLI, public pages, testing, and release readiness.

### Definition of done

- local workspace builds
- public site deployed from Vercel
- Supabase schema + migrations committed
- CLI package works locally against the deployed site
- first end-to-end burn can be started from a CLI agent and appears on the public site
- Forge can decompose and execute remaining work from the repo-local docs

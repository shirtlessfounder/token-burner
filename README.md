# token-burner

Public spectacle site plus zero-install CLI flow for wasting AI tokens on purpose.

## Product shape

- public website on Vercel
- Supabase-backed public state and provider-split leaderboards
- **burn-in-session model**: your CLI agent (Claude Code, Codex, Cursor, etc.) generates the tokens itself using its existing provider auth and POSTs step events directly to the site. No subprocess, no provider key changes hands.
- server-side tokenizer verification: agent submits the actual generated text in each event, server runs it through a tokenizer to compute the canonical count. ✓ verified badge appears on burns + leaderboard.
- one human identity can link many agent installations
- no normal website login in v1

## Current repo state

- public homepage with provider-split leaderboards and live burn feed
- public profile pages and burn detail pages with full generated content gallery per burn
- CLI commands for `register`, `link`, `whoami` (identity helpers; no creds touched)
- legacy `burn` subcommand kept for backwards compat — not the recommended path
- burn API routes (`start` / `events` / `heartbeat` / `finish`), server-side tokenizer verification, opportunistic stale-burn sweeper

## Workspace

```text
apps/site         public website
packages/agent-cli CLI package used via npx
packages/shared   shared schemas and domain types
docs/product      approved design + delivery plan
docs/ops          infrastructure source of truth
```

## Local development

```bash
npm install
npm run dev --workspace @token-burner/site
npm run test -- --run tests/unit/agent-cli-commands.test.ts tests/unit/agent-cli-burn.test.ts
npm run typecheck
```

## Running The CLI

Published as [`token-burner`](https://www.npmjs.com/package/token-burner). Zero install:

```bash
npx token-burner <subcommand>
```

To hack on the CLI in this repo, use the workspace binary instead:

```bash
npm exec --workspace token-burner token-burner -- <subcommand>
```

## First-Time CLI Flow

1. Open the public site and generate a claim code.
2. Register the first installation:

```bash
token-burner register --claim-code ABCD1234 --handle alembic --avatar X --agent-label codex@laptop
```

3. Optionally link another installation to the same human identity:

```bash
token-burner link --agent-label codex@desktop
```

4. Inspect the stored local identity state:

```bash
token-burner whoami
```

## Burning (in-session, recommended)

Burns happen **inside your CLI agent's session**, not in a subprocess. After `register`, the agent reads its own `~/.config/token-burner/config.json`, asks you for a target (e.g. `25k`), and runs the HTTP burn loop documented in [`apps/site/public/skill.md`](https://token-burner-seven.vercel.app/skill.md):

1. POST `/api/burns/start` with `ownerToken`, `agentInstallationId`, `provider`, `targetTokens`
2. generate output in the agent's own LLM session (no subprocess)
3. POST each chunk's text to `/api/burns/{id}/events` — server tokenizes (`o200k_base`), returns canonical cumulative count
4. heartbeat between long steps
5. POST `/api/burns/{id}/finish` when target hit (or on any exit path)

No `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` needed. No `--api-key` flag. The agent IS the burner.

## Legacy `burn` subcommand

The CLI still ships `token-burner burn` for users who explicitly want a subprocess + their own provider key in env. It works but is **not the recommended path** — the demo prompt and the skill both route around it.

```bash
token-burner burn --provider anthropic --target 50000          # legacy
token-burner burn --provider openai --preset tier-2 --api-key sk-...  # legacy
```

If `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` is missing AND no `--api-key` is passed, the legacy path exits early.

## Docs

- product design: `docs/product/design.md`
- delivery plan: `docs/product/delivery-plan.md`
- infrastructure: `docs/ops/INFRASTRUCTURE.md`

# token-burner

Public spectacle site plus zero-install CLI flow for wasting AI tokens on purpose.

## Product shape

- public website on Vercel
- Supabase-backed public state and provider-split leaderboards
- CLI-started burns using the human's own local provider credentials
- no normal website login in v1
- no provider key storage on the website
- one human identity can link many agent installations

## Current repo state

- public homepage with provider-split leaderboards and live burn feed
- public profile pages and burn detail pages
- CLI commands for `register`, `link`, `whoami`, and `burn`
- burn API routes, live telemetry ingestion, Anthropic + OpenAI adapters, and preset tiers

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

## Running The CLI From This Repo

The package is not published yet. From the repo root, use the workspace binary:

```bash
npm exec --workspace @token-burner/agent-cli token-burner-agent -- <subcommand>
```

All command examples below use the shorter `token-burner-agent` form.

## First-Time CLI Flow

1. Open the public site and generate a claim code.
2. Register the first installation:

```bash
token-burner-agent register --claim-code ABCD1234 --handle alembic --avatar X --agent-label codex@laptop
```

3. Optionally link another installation to the same human identity:

```bash
token-burner-agent link --agent-label codex@desktop
```

4. Inspect the stored local identity state:

```bash
token-burner-agent whoami
```

## Burn Command

Choose exactly one of `--target` or `--preset`.

Custom target example using Anthropic:

```bash
token-burner-agent burn --provider anthropic --target 50000
```

Preset-tier example using OpenAI:

```bash
token-burner-agent burn --provider openai --preset tier-2
```

Current preset tiers:

- `tier-1` - `Amuse-Bouche` (`25,000` billed tokens)
- `tier-2` - `Statement Piece` (`250,000` billed tokens)
- `tier-3` - `Couture Run` (`2,500,000` billed tokens)

You can optionally point the CLI at a non-default site origin with `--base-url https://token-burner.test`.

## Local Provider Credentials

Burns start from the CLI package, not from the browser. Provider keys stay on your machine and are not stored on the website.

Set the official provider env vars before burning:

```bash
export ANTHROPIC_API_KEY=...
export OPENAI_API_KEY=...
```

If the relevant env var is missing, `token-burner-agent burn` exits without starting a burn.

## Docs

- product design: `docs/product/design.md`
- delivery plan: `docs/product/delivery-plan.md`
- infrastructure: `docs/ops/INFRASTRUCTURE.md`

# token-burner

Public spectacle site plus zero-install CLI flow for wasting AI tokens on purpose.

## Product shape

- public website on Vercel
- Supabase-backed public state and leaderboards
- CLI-started burns using the human's own local provider credentials
- no normal website login in v1
- no provider key storage on the website

## Workspace

```text
apps/site         public website
packages/agent-cli CLI package used via npx
packages/shared   shared schemas and domain types
docs/product      approved design + delivery plan
docs/ops          infrastructure source of truth
```

## Current status

Chunk 1 bootstrap is in progress:

- repo scaffolded
- Vercel project created and linked
- Supabase project created and linked
- infra baseline docs written

## Local commands

```bash
npm install
npm run dev --workspace @token-burner/site
npm run build --workspace @token-burner/site
```

## Docs

- product design: `docs/product/design.md`
- delivery plan: `docs/product/delivery-plan.md`
- infrastructure: `docs/ops/INFRASTRUCTURE.md`

# Token Burner Whole-Scope Delivery Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the full approved `token-burner` product as a new standalone public website plus zero-install agent CLI flow, where humans claim identities from the site, start burns from their CLI agents, and appear on public provider-split leaderboards.

**Architecture:** Build a small npm-workspace monorepo with a public Next.js site in `apps/site` and a publishable CLI package in `packages/agent-cli`. The website is a public stage backed by Supabase Postgres and app-owned HTTP APIs; the CLI package is the execution boundary that registers humans, stores reusable owner tokens locally, uses local official provider credentials, executes burns, and streams telemetry back to the site.

**Tech Stack:** GitHub CLI, npm workspaces, Next.js App Router, React, TypeScript, Tailwind CSS, Supabase Postgres, Drizzle ORM, `pg`, `zod`, `commander`, `tsx`, Vitest, Playwright, Node `crypto`, Node `fs`

---

## Proposed Repository Structure

### Root workspace and docs

- `/Users/dylanvu/token-burner/package.json` — npm workspaces, shared scripts, package publish metadata
- `/Users/dylanvu/token-burner/package-lock.json` — locked dependency graph
- `/Users/dylanvu/token-burner/tsconfig.base.json` — shared TS settings for site, CLI, and shared package
- `/Users/dylanvu/token-burner/.env.example` — required Vercel and local dev env contract
- `/Users/dylanvu/token-burner/README.md` — local setup, deploy, and usage instructions
- `/Users/dylanvu/token-burner/AGENTS.md` — repo-local agent instructions pointing at product docs
- `/Users/dylanvu/token-burner/docs/product/design.md` — repo-local copy of the approved design
- `/Users/dylanvu/token-burner/docs/product/delivery-plan.md` — repo-local copy of this plan
- `/Users/dylanvu/token-burner/docs/product/epic-issue.md` — GitHub epic issue body for Forge intake
- `/Users/dylanvu/token-burner/docs/ops/INFRASTRUCTURE.md` — source of truth for Vercel, Supabase, npm package, env vars, and smoke tests

### Public website

- `/Users/dylanvu/token-burner/apps/site/package.json` — Next.js app package
- `/Users/dylanvu/token-burner/apps/site/next.config.ts` — Next.js config
- `/Users/dylanvu/token-burner/apps/site/src/app/layout.tsx` — global shell
- `/Users/dylanvu/token-burner/apps/site/src/app/globals.css` — brand tokens and motion
- `/Users/dylanvu/token-burner/apps/site/src/app/page.tsx` — leaderboard-first homepage
- `/Users/dylanvu/token-burner/apps/site/src/app/u/[handle]/page.tsx` — public human profile
- `/Users/dylanvu/token-burner/apps/site/src/app/burns/[burnId]/page.tsx` — public live/completed burn page
- `/Users/dylanvu/token-burner/apps/site/public/skill.md` — canonical bootstrap instructions for CLI agents
- `/Users/dylanvu/token-burner/apps/site/src/app/api/claim-codes/route.ts` — anonymous claim-code generation
- `/Users/dylanvu/token-burner/apps/site/src/app/api/agent/register/route.ts` — first-time human creation via claim code
- `/Users/dylanvu/token-burner/apps/site/src/app/api/agent/link/route.ts` — owner-token-based linking of additional agent installations
- `/Users/dylanvu/token-burner/apps/site/src/app/api/burns/start/route.ts` — owner-token-authenticated burn creation
- `/Users/dylanvu/token-burner/apps/site/src/app/api/burns/[burnId]/heartbeat/route.ts` — keepalive and progress updates
- `/Users/dylanvu/token-burner/apps/site/src/app/api/burns/[burnId]/events/route.ts` — per-step usage telemetry
- `/Users/dylanvu/token-burner/apps/site/src/app/api/burns/[burnId]/finish/route.ts` — burn completion/interruption

### Shared package

- `/Users/dylanvu/token-burner/packages/shared/package.json` — shared runtime types package
- `/Users/dylanvu/token-burner/packages/shared/src/api.ts` — request/response schemas for claim, register, link, burn, telemetry
- `/Users/dylanvu/token-burner/packages/shared/src/domain.ts` — provider IDs, burn status enums, preset IDs
- `/Users/dylanvu/token-burner/packages/shared/src/index.ts` — shared exports

### Agent CLI package

- `/Users/dylanvu/token-burner/packages/agent-cli/package.json` — publishable package named for `npx`
- `/Users/dylanvu/token-burner/packages/agent-cli/src/cli.ts` — command entrypoint
- `/Users/dylanvu/token-burner/packages/agent-cli/src/commands/register.ts` — first-time claim flow
- `/Users/dylanvu/token-burner/packages/agent-cli/src/commands/link.ts` — link an additional agent installation to an existing human
- `/Users/dylanvu/token-burner/packages/agent-cli/src/commands/burn.ts` — start and execute a burn
- `/Users/dylanvu/token-burner/packages/agent-cli/src/commands/whoami.ts` — inspect the current linked human/agent state
- `/Users/dylanvu/token-burner/packages/agent-cli/src/config/local-store.ts` — owner-token persistence under local config dir
- `/Users/dylanvu/token-burner/packages/agent-cli/src/api/client.ts` — calls website APIs
- `/Users/dylanvu/token-burner/packages/agent-cli/src/providers/types.ts` — provider adapter contract
- `/Users/dylanvu/token-burner/packages/agent-cli/src/providers/openai.ts` — OpenAI burn adapter
- `/Users/dylanvu/token-burner/packages/agent-cli/src/providers/anthropic.ts` — Anthropic burn adapter
- `/Users/dylanvu/token-burner/packages/agent-cli/src/providers/resolve-credentials.ts` — env-first local credential discovery
- `/Users/dylanvu/token-burner/packages/agent-cli/src/runtime/compute-safe-request.ts` — conservative cap enforcement
- `/Users/dylanvu/token-burner/packages/agent-cli/src/runtime/parent-watch.ts` — stop if the parent CLI agent session dies
- `/Users/dylanvu/token-burner/packages/agent-cli/src/runtime/run-burn.ts` — burn loop and telemetry submission

### Data layer

- `/Users/dylanvu/token-burner/drizzle.config.ts` — migration config
- `/Users/dylanvu/token-burner/drizzle/*.sql` — schema migrations
- `/Users/dylanvu/token-burner/apps/site/src/lib/db/client.ts` — pooled Postgres client
- `/Users/dylanvu/token-burner/apps/site/src/lib/db/schema.ts` — Drizzle schema
- `/Users/dylanvu/token-burner/apps/site/src/lib/db/queries.ts` — leaderboard, feed, profile, and burn selectors
- `/Users/dylanvu/token-burner/apps/site/src/lib/server/auth.ts` — owner-token verification and claim-code validation helpers
- `/Users/dylanvu/token-burner/apps/site/src/lib/server/housekeeping.ts` — stale-burn interruption and one-active-burn enforcement

### Tests

- `/Users/dylanvu/token-burner/tests/unit/*.test.ts` — shared schemas, token hashing, local config, cap math, provider adapters
- `/Users/dylanvu/token-burner/tests/integration/*.test.ts` — API routes, DB mutations, stale-burn handling
- `/Users/dylanvu/token-burner/tests/e2e/*.spec.ts` — homepage claim flow, public site updates, CLI-driven burn lifecycle

## Chunk 1: Bootstrap Repo, Workspace, Cloud Projects, and Forge Intake

### Task 1: Create the repo, clone it locally, and scaffold the npm workspace

**Files:**
- Create: `/Users/dylanvu/token-burner/*`
- Test: GitHub repo state and workspace install/build sanity

- [ ] **Step 1: Verify the repo does not already exist**

Run:

```bash
gh repo view shirtlessfounder/token-burner --json name,owner,visibility,url
```

Expected:
- GitHub returns not found before creation

- [ ] **Step 2: Create the public GitHub repo**

Run:

```bash
gh repo create shirtlessfounder/token-burner --public --clone=false
```

Expected:
- GitHub confirms `shirtlessfounder/token-burner` exists

- [ ] **Step 3: Clone to the required local path**

Run:

```bash
git clone https://github.com/shirtlessfounder/token-burner.git /Users/dylanvu/token-burner
```

Expected:
- `/Users/dylanvu/token-burner/.git` exists

- [ ] **Step 4: Create the workspace root**

Create:

```json
{
  "name": "token-burner",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "npm run dev --workspace @token-burner/site",
    "build": "npm run build --workspace @token-burner/site && npm run build --workspace @token-burner/agent-cli",
    "lint": "npm run lint --workspace @token-burner/site && npm run lint --workspace @token-burner/agent-cli",
    "typecheck": "npm run typecheck --workspaces",
    "test": "vitest run",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 5: Scaffold the Next.js site in `apps/site`**

Run:

```bash
cd /Users/dylanvu/token-burner
npx create-next-app@latest apps/site --ts --tailwind --eslint --app --src-dir --use-npm --yes --import-alias "@/*"
```

Expected:
- `apps/site` contains a working Next.js app

- [ ] **Step 6: Create the package directories for `shared` and `agent-cli`**

Create:

```text
/Users/dylanvu/token-burner/packages/shared
/Users/dylanvu/token-burner/packages/agent-cli
```

- [ ] **Step 7: Verify the workspace installs and the site builds**

Run:

```bash
cd /Users/dylanvu/token-burner
npm install
npm run build --workspace @token-burner/site
```

Expected:
- install succeeds
- site build succeeds

- [ ] **Step 8: Commit the skeleton**

Run:

```bash
cd /Users/dylanvu/token-burner
git add .
git commit -m "chore: scaffold token burner workspace"
```

### Task 2: Provision fresh Vercel and Supabase projects and record the infra

**Files:**
- Create: `/Users/dylanvu/token-burner/.env.example`
- Create: `/Users/dylanvu/token-burner/docs/ops/INFRASTRUCTURE.md`
- Create: `/Users/dylanvu/token-burner/drizzle.config.ts`
- Test: Vercel project inspection and Supabase linkage

- [ ] **Step 1: Verify the required CLIs are available**

Run:

```bash
npx vercel --version
npx supabase --version
```

Expected:
- both CLIs resolve and print versions

- [ ] **Step 2: Create and link a fresh Vercel project named `token-burner`**

Run:

```bash
cd /Users/dylanvu/token-burner/apps/site
npx vercel project add token-burner
npx vercel link --yes --project token-burner
```

Expected:
- the site checkout is linked to a new Vercel project

- [ ] **Step 3: Create a fresh Supabase project**

Run:

```bash
npx supabase login
npx supabase orgs list
export SUPABASE_DB_PASSWORD="$(openssl rand -base64 24)"
npx supabase projects create token-burner --org-id <shirtless-org-id> --db-password "$SUPABASE_DB_PASSWORD" --region us-east-1
```

Expected:
- a new Supabase project named `token-burner` exists in `us-east-1`
- the generated password is stored in the password manager before continuing

- [ ] **Step 4: Link the repo to the new Supabase project**

Run:

```bash
cd /Users/dylanvu/token-burner
npx supabase link --project-ref <new-project-ref> --password "$SUPABASE_DB_PASSWORD"
```

Expected:
- local Supabase linkage is configured for the repo

- [ ] **Step 5: Write `.env.example` with the actual app contract**

Required env keys:
- `DATABASE_URL`
- `DATABASE_URL_MIGRATIONS`
- `NEXT_PUBLIC_APP_URL`
- `TOKEN_BURNER_BASE_URL`
- `OWNER_TOKEN_HASH_SECRET`
- `CLAIM_CODE_SIGNING_SECRET`
- `OPENAI_BURN_MODEL`
- `ANTHROPIC_BURN_MODEL`
- `STALE_BURN_TIMEOUT_SECONDS`

- [ ] **Step 6: Write `docs/ops/INFRASTRUCTURE.md`**

Document:
- Vercel project name
- Supabase project ref
- connection string types to use
- env var source of truth
- local dev steps
- deploy steps
- smoke test steps
- npm package name for the CLI

- [ ] **Step 7: Verify cloud linkage**

Run:

```bash
cd /Users/dylanvu/token-burner/apps/site
npx vercel project inspect token-burner
cd /Users/dylanvu/token-burner
npx supabase projects list
```

Expected:
- Vercel shows the new project
- Supabase lists the new `token-burner` project

- [ ] **Step 8: Commit the infra bootstrap**

Run:

```bash
cd /Users/dylanvu/token-burner
git add .env.example docs/ops/INFRASTRUCTURE.md drizzle.config.ts
git commit -m "chore: bootstrap token burner infrastructure"
```

### Task 3: Copy the product docs into the repo and seed Forge intake

**Files:**
- Create: `/Users/dylanvu/token-burner/AGENTS.md`
- Create: `/Users/dylanvu/token-burner/README.md`
- Create: `/Users/dylanvu/token-burner/docs/product/design.md`
- Create: `/Users/dylanvu/token-burner/docs/product/delivery-plan.md`
- Create: `/Users/dylanvu/token-burner/docs/product/epic-issue.md`
- Modify: `/Users/dylanvu/Forge/templates/worker.json`
- Modify: `/Users/dylanvu/Forge/templates/planner.json`
- Modify: `/Users/dylanvu/Forge/templates/super.json`
- Modify: `/Users/dylanvu/Forge/apps/forge-cli/config.toml`
- Test: label seeding, epic creation, and `forge status`

- [ ] **Step 1: Create repo-local `AGENTS.md`**

Include:

```markdown
Read these files before planning or implementing work in this repo:

- `docs/product/design.md`
- `docs/product/delivery-plan.md`

Repo purpose:

- public token burner website
- agent-first CLI onboarding and burn flow
- no provider keys stored on the website
```

- [ ] **Step 2: Copy the approved design and this plan into `docs/product/`**

Source files:
- `/Users/dylanvu/Forge/docs/superpowers/specs/2026-04-20-token-burner-design.md`
- `/Users/dylanvu/Forge/docs/superpowers/plans/2026-04-20-token-burner-whole-scope-delivery.md`

- [ ] **Step 3: Write `docs/product/epic-issue.md`**

Required issue body contents:
- summary of the whole-scope delivery
- references to `docs/product/design.md`
- references to `docs/product/delivery-plan.md`
- subtask checklist placeholder

- [ ] **Step 4: Seed Forge labels in the new GitHub repo**

Run:

```bash
gh label create "status:ready-for-planning" --color C2E0C6 --description "Awaiting planner to scope and break down" -R shirtlessfounder/token-burner
gh label create "status:planning" --color FEF2C0 --description "Being broken down into sub-tasks" -R shirtlessfounder/token-burner
gh label create "status:ready-for-work" --color BFDADC --description "Ready for a worker to claim" -R shirtlessfounder/token-burner
gh label create "status:in-progress" --color F9D0C4 --description "Claimed and actively being worked on" -R shirtlessfounder/token-burner
gh label create "status:needs-review" --color D4C5F9 --description "PR open and awaiting review" -R shirtlessfounder/token-burner
gh label create "status:blocked" --color D93F0B --description "Blocked on a dependency or decision" -R shirtlessfounder/token-burner
gh label create "status:done" --color 0E8A16 --description "Completed and merged" -R shirtlessfounder/token-burner
gh label create "role:worker" --color 1D76DB --description "Should be picked up by a worker agent" -R shirtlessfounder/token-burner
gh label create "role:planner" --color 5319E7 --description "Needs planner ownership" -R shirtlessfounder/token-burner
gh label create "role:super" --color FBCA04 --description "Needs super review" -R shirtlessfounder/token-burner
gh label create "role:admin" --color B60205 --description "Requires human admin action" -R shirtlessfounder/token-burner
gh label create "type:epic" --color 0052CC --description "Multi-task parent issue" -R shirtlessfounder/token-burner
gh label create "type:task" --color 0E8A16 --description "Standard work item" -R shirtlessfounder/token-burner
gh label create "type:fix" --color D73A4A --description "Bug fix or corrective follow-up" -R shirtlessfounder/token-burner
```

- [ ] **Step 5: Open the initial epic issue**

Run:

```bash
cd /Users/dylanvu/token-burner
gh issue create -R shirtlessfounder/token-burner --title "Deliver token-burner whole scope" --body-file docs/product/epic-issue.md --label type:epic --label role:planner --label status:ready-for-planning
```

Expected:
- planner-intake epic exists in the new repo

- [ ] **Step 6: Repoint Forge to `shirtlessfounder/token-burner`**

Set in all three templates:

```json
"repo": "github.com/shirtlessfounder/token-burner"
```

Set in `apps/forge-cli/config.toml`:

```toml
[repo]
name = "shirtlessfounder/token-burner"
dir = "/Users/dylanvu/Forge"
```

- [ ] **Step 7: Verify Forge remains empty before swarm bring-up**

Run:

```bash
cd /Users/dylanvu/Forge
uv run forge status
```

Expected:
- no agents configured yet

- [ ] **Step 8: Commit the repo docs and Forge retarget**

Run:

```bash
cd /Users/dylanvu/token-burner
git add AGENTS.md README.md docs/product
git commit -m "docs: add token burner product docs"

cd /Users/dylanvu/Forge
git add templates/worker.json templates/planner.json templates/super.json apps/forge-cli/config.toml
git commit -m "chore: retarget forge to token burner"
```

## Chunk 2: Shared Contracts, Schema, and Server Runtime

### Task 4: Establish shared package contracts and workspace tooling

**Files:**
- Modify: `/Users/dylanvu/token-burner/package.json`
- Modify: `/Users/dylanvu/token-burner/tsconfig.base.json`
- Create: `/Users/dylanvu/token-burner/packages/shared/package.json`
- Create: `/Users/dylanvu/token-burner/packages/shared/src/api.ts`
- Create: `/Users/dylanvu/token-burner/packages/shared/src/domain.ts`
- Create: `/Users/dylanvu/token-burner/packages/shared/src/index.ts`
- Create: `/Users/dylanvu/token-burner/tests/unit/shared-api.test.ts`
- Test: `/Users/dylanvu/token-burner/tests/unit/shared-api.test.ts`

- [ ] **Step 1: Write the failing shared-schema test**

Example assertions:

```ts
expect(parseClaimCodeResponse({ code: "ABC123", expiresAt: "2026-04-21T00:00:00Z" }).code).toBe("ABC123")
expect(() => parseBurnStartRequest({ provider: "openai", targetTokens: 0 })).toThrow(/targetTokens/)
```

- [ ] **Step 2: Create the `packages/shared` package and wire workspace scripts**

Required root scripts:
- `dev`
- `build`
- `lint`
- `typecheck`
- `test`
- `test:e2e`

- [ ] **Step 3: Implement the shared request/response schemas**

Required domains:
- claim codes
- register/link responses
- burn start responses
- heartbeat payloads
- telemetry events
- burn status enum
- provider enum
- preset ID enum

- [ ] **Step 4: Run the shared-schema test and typecheck**

Run:

```bash
cd /Users/dylanvu/token-burner
npm run test -- --run tests/unit/shared-api.test.ts
npm run typecheck
```

Expected:
- both commands pass

- [ ] **Step 5: Commit**

Run:

```bash
cd /Users/dylanvu/token-burner
git add package.json tsconfig.base.json packages/shared tests/unit/shared-api.test.ts
git commit -m "chore: add shared api contracts"
```

### Task 5: Create the database schema for humans, agent links, burns, and public views

**Files:**
- Create: `/Users/dylanvu/token-burner/apps/site/src/lib/db/schema.ts`
- Create: `/Users/dylanvu/token-burner/apps/site/src/lib/db/client.ts`
- Create: `/Users/dylanvu/token-burner/apps/site/src/lib/db/queries.ts`
- Create: `/Users/dylanvu/token-burner/apps/site/src/lib/server/auth.ts`
- Create: `/Users/dylanvu/token-burner/apps/site/src/lib/server/housekeeping.ts`
- Create: `/Users/dylanvu/token-burner/drizzle/0001_initial.sql`
- Create: `/Users/dylanvu/token-burner/tests/integration/db-schema.test.ts`
- Test: `/Users/dylanvu/token-burner/tests/integration/db-schema.test.ts`

- [ ] **Step 1: Write the failing schema/invariant test**

Example assertions:

```ts
expect(await createSecondRunningBurnForSameHuman()).toThrow(/one active burn/i)
expect(await verifyOwnerToken("bad-token")).toBeNull()
```

- [ ] **Step 2: Implement the core tables**

Required tables:
- `humans`
- `agent_installations`
- `claim_codes`
- `owner_tokens`
- `burns`
- `burn_events`

Required burn columns:

```sql
requested_billed_token_target bigint not null check (requested_billed_token_target > 0)
billed_tokens_consumed bigint not null default 0
status text not null
provider text not null
model text not null
last_heartbeat_at timestamptz null
```

Required uniqueness and indexes:

```sql
create unique index burns_one_active_per_human_idx
on burns (human_id)
where status in ('queued', 'running', 'stopping');

create unique index humans_public_handle_idx
on humans (lower(public_handle));
```

- [ ] **Step 3: Implement owner-token verification and claim-code validation**

Required behavior:
- owner tokens stored as hash + metadata, not plaintext
- claim codes are one-time use
- stale running burns can be marked interrupted before a new burn starts

- [ ] **Step 4: Add public selectors for**

- homepage live burns
- provider-split daily leaderboard
- provider-split weekly leaderboard
- provider-split all-time leaderboard
- public profile lookup by handle
- public burn lookup by burn ID

- [ ] **Step 5: Run the schema test**

Run:

```bash
cd /Users/dylanvu/token-burner
npm run test -- --run tests/integration/db-schema.test.ts
```

Expected:
- PASS

- [ ] **Step 6: Commit**

Run:

```bash
cd /Users/dylanvu/token-burner
git add apps/site/src/lib/db apps/site/src/lib/server drizzle tests/integration/db-schema.test.ts
git commit -m "feat: add token burner schema and server data layer"
```

## Chunk 3: Public Site and Agent Bootstrap Surface

### Task 6: Build the public site shell and homepage spectacle

**Files:**
- Modify: `/Users/dylanvu/token-burner/apps/site/src/app/layout.tsx`
- Modify: `/Users/dylanvu/token-burner/apps/site/src/app/globals.css`
- Modify: `/Users/dylanvu/token-burner/apps/site/src/app/page.tsx`
- Create: `/Users/dylanvu/token-burner/apps/site/src/components/home/hero.tsx`
- Create: `/Users/dylanvu/token-burner/apps/site/src/components/home/leaderboards.tsx`
- Create: `/Users/dylanvu/token-burner/apps/site/src/components/home/live-feed.tsx`
- Create: `/Users/dylanvu/token-burner/tests/integration/homepage.test.tsx`
- Test: `/Users/dylanvu/token-burner/tests/integration/homepage.test.tsx`

- [ ] **Step 1: Write the failing homepage integration test**

Example assertions:

```tsx
expect(screen.getByText(/daily leaderboard/i)).toBeInTheDocument()
expect(screen.getByText(/live burns/i)).toBeInTheDocument()
expect(screen.getByText(/send your agent/i)).toBeInTheDocument()
```

- [ ] **Step 2: Replace the default styling with the approved visual system**

Required design cues:
- opulent
- theatrical
- editorial
- intentionally ridiculous
- not generic SaaS chrome

- [ ] **Step 3: Implement homepage data loading**

Required order above the fold:
1. provider-split leaderboard
2. live burns feed
3. agent onboarding prompt / claim area

- [ ] **Step 4: Run the homepage test and lint**

Run:

```bash
cd /Users/dylanvu/token-burner
npm run test -- --run tests/integration/homepage.test.tsx
npm run lint --workspace @token-burner/site
```

Expected:
- both commands pass

- [ ] **Step 5: Commit**

Run:

```bash
cd /Users/dylanvu/token-burner
git add apps/site/src/app apps/site/src/components/home tests/integration/homepage.test.tsx
git commit -m "feat: add public homepage spectacle"
```

### Task 7: Implement claim-code generation and publish the public `skill.md`

**Files:**
- Create: `/Users/dylanvu/token-burner/apps/site/public/skill.md`
- Create: `/Users/dylanvu/token-burner/apps/site/src/app/api/claim-codes/route.ts`
- Create: `/Users/dylanvu/token-burner/apps/site/src/components/home/claim-panel.tsx`
- Create: `/Users/dylanvu/token-burner/tests/integration/claim-codes-route.test.ts`
- Test: `/Users/dylanvu/token-burner/tests/integration/claim-codes-route.test.ts`

- [ ] **Step 1: Write the failing claim-code route test**

Example assertions:

```ts
expect(response.status).toBe(201)
expect(body.code).toMatch(/^[A-Z0-9-]+$/)
expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now())
```

- [ ] **Step 2: Implement anonymous claim-code issuance**

Required behavior:
- no human login
- one-time use code
- expiration timestamp
- lightweight rate limiting by IP/session

- [ ] **Step 3: Write the canonical `skill.md`**

Required contents:
- explain the product in one paragraph
- tell the agent never to send provider keys to the website
- explain first-time claim flow
- explain owner-token reuse
- explain `npx` command shapes for register/link/burn

- [ ] **Step 4: Add the homepage claim panel**

Required UI:
- generate claim code button
- visible prompt block for copy/paste
- link to `/skill.md`

- [ ] **Step 5: Run the claim-code test**

Run:

```bash
cd /Users/dylanvu/token-burner
npm run test -- --run tests/integration/claim-codes-route.test.ts
```

Expected:
- PASS

- [ ] **Step 6: Commit**

Run:

```bash
cd /Users/dylanvu/token-burner
git add apps/site/public/skill.md apps/site/src/app/api/claim-codes apps/site/src/components/home/claim-panel.tsx tests/integration/claim-codes-route.test.ts
git commit -m "feat: add claim codes and public bootstrap doc"
```

### Task 8: Build the public profile and live burn pages

**Files:**
- Create: `/Users/dylanvu/token-burner/apps/site/src/app/u/[handle]/page.tsx`
- Create: `/Users/dylanvu/token-burner/apps/site/src/app/burns/[burnId]/page.tsx`
- Create: `/Users/dylanvu/token-burner/apps/site/src/components/profile/profile-header.tsx`
- Create: `/Users/dylanvu/token-burner/apps/site/src/components/burn/live-counter.tsx`
- Create: `/Users/dylanvu/token-burner/tests/integration/public-pages.test.tsx`
- Test: `/Users/dylanvu/token-burner/tests/integration/public-pages.test.tsx`

- [ ] **Step 1: Write the failing public-pages test**

Example assertions:

```tsx
expect(screen.getByText(/recent burns/i)).toBeInTheDocument()
expect(screen.getByText(/billed tokens/i)).toBeInTheDocument()
```

- [ ] **Step 2: Implement the public profile page**

Required visible data:
- avatar
- public handle
- provider-specific totals
- recent burns

- [ ] **Step 3: Implement the public burn page**

Required visible data:
- human handle
- provider
- fixed model
- target tokens
- current billed total
- final status

- [ ] **Step 4: Poll for live updates**

Constraint:
- keep v1 simple with short polling or refresh-based server fetches
- do not add a separate realtime infrastructure layer unless tests force it

- [ ] **Step 5: Run the public-pages test**

Run:

```bash
cd /Users/dylanvu/token-burner
npm run test -- --run tests/integration/public-pages.test.tsx
```

Expected:
- PASS

- [ ] **Step 6: Commit**

Run:

```bash
cd /Users/dylanvu/token-burner
git add apps/site/src/app/u apps/site/src/app/burns apps/site/src/components/profile apps/site/src/components/burn tests/integration/public-pages.test.tsx
git commit -m "feat: add public profile and burn pages"
```

## Chunk 4: Agent CLI Package and Local Identity Persistence

### Task 9: Scaffold the publishable CLI package and local config storage

**Files:**
- Create: `/Users/dylanvu/token-burner/packages/agent-cli/package.json`
- Create: `/Users/dylanvu/token-burner/packages/agent-cli/tsconfig.json`
- Create: `/Users/dylanvu/token-burner/packages/agent-cli/src/cli.ts`
- Create: `/Users/dylanvu/token-burner/packages/agent-cli/src/config/local-store.ts`
- Create: `/Users/dylanvu/token-burner/tests/unit/local-store.test.ts`
- Test: `/Users/dylanvu/token-burner/tests/unit/local-store.test.ts`

- [ ] **Step 1: Write the failing local-store test**

Example assertions:

```ts
await saveLocalConfig(tmpHome, { ownerToken: "tok_123", humanId: "h_1" })
expect(await loadLocalConfig(tmpHome)).toEqual(expect.objectContaining({ ownerToken: "tok_123" }))
```

- [ ] **Step 2: Create the CLI package metadata**

Required package fields:
- publishable name suitable for `npx`
- `bin` entry for the executable
- `files` whitelist
- `build` script

- [ ] **Step 3: Implement local config persistence**

Required path:
- `~/.config/token-burner/config.json`

Required stored fields:
- `ownerToken`
- `humanId`
- `agentInstallationId`
- `baseUrl`

- [ ] **Step 4: Add a minimal CLI entrypoint with `register`, `link`, `burn`, and `whoami` commands**

- [ ] **Step 5: Run the local-store test**

Run:

```bash
cd /Users/dylanvu/token-burner
npm run test -- --run tests/unit/local-store.test.ts
```

Expected:
- PASS

- [ ] **Step 6: Commit**

Run:

```bash
cd /Users/dylanvu/token-burner
git add packages/agent-cli tests/unit/local-store.test.ts
git commit -m "feat: scaffold token burner agent cli"
```

### Task 10: Implement registration, linking, and owner-token-backed API auth

**Files:**
- Create: `/Users/dylanvu/token-burner/packages/agent-cli/src/api/client.ts`
- Create: `/Users/dylanvu/token-burner/packages/agent-cli/src/commands/register.ts`
- Create: `/Users/dylanvu/token-burner/packages/agent-cli/src/commands/link.ts`
- Create: `/Users/dylanvu/token-burner/packages/agent-cli/src/commands/whoami.ts`
- Create: `/Users/dylanvu/token-burner/apps/site/src/app/api/agent/register/route.ts`
- Create: `/Users/dylanvu/token-burner/apps/site/src/app/api/agent/link/route.ts`
- Create: `/Users/dylanvu/token-burner/tests/integration/agent-registration.test.ts`
- Test: `/Users/dylanvu/token-burner/tests/integration/agent-registration.test.ts`

- [ ] **Step 1: Write the failing registration/linking test**

Example assertions:

```ts
expect(registerResponse.status).toBe(201)
expect(registerResponse.body.ownerToken).toMatch(/^tb_owner_/)
expect(linkResponse.body.humanId).toBe(registerResponse.body.humanId)
```

- [ ] **Step 2: Implement `POST /api/agent/register`**

Required request fields:
- `claimCode`
- `publicHandle`
- `avatar`
- `agentLabel`

Required response fields:
- `humanId`
- `ownerToken`
- `agentInstallationId`

- [ ] **Step 3: Implement `POST /api/agent/link`**

Required request fields:
- `ownerToken`
- `agentLabel`

Required response fields:
- `humanId`
- `agentInstallationId`

- [ ] **Step 4: Implement CLI commands for `register`, `link`, and `whoami`**

Required behaviors:
- `register` stores owner token locally
- `link` stores updated installation state locally
- `whoami` prints human handle, human id, and installation id

- [ ] **Step 5: Run the registration/link test**

Run:

```bash
cd /Users/dylanvu/token-burner
npm run test -- --run tests/integration/agent-registration.test.ts
```

Expected:
- PASS

- [ ] **Step 6: Commit**

Run:

```bash
cd /Users/dylanvu/token-burner
git add packages/agent-cli/src/api packages/agent-cli/src/commands apps/site/src/app/api/agent tests/integration/agent-registration.test.ts
git commit -m "feat: add agent registration and linking flow"
```

## Chunk 5: Local Provider Credential Discovery and Burn Execution

### Task 11: Implement local provider credential resolution with env-first behavior

**Files:**
- Create: `/Users/dylanvu/token-burner/packages/agent-cli/src/providers/types.ts`
- Create: `/Users/dylanvu/token-burner/packages/agent-cli/src/providers/resolve-credentials.ts`
- Create: `/Users/dylanvu/token-burner/tests/unit/resolve-credentials.test.ts`
- Test: `/Users/dylanvu/token-burner/tests/unit/resolve-credentials.test.ts`

- [ ] **Step 1: Write the failing credential-resolution test**

Example assertions:

```ts
expect(resolveCredentials("openai", { OPENAI_API_KEY: "sk-openai" }, fsFixtures)?.apiKey).toBe("sk-openai")
expect(resolveCredentials("anthropic", {}, fsFixtures)).toBeNull()
```

- [ ] **Step 2: Implement the provider credential contract**

Required return shape:
- `provider`
- `apiKey`
- `source`

Allowed sources in v1:
- `env`
- `supported-config-file`

- [ ] **Step 3: Implement env-var readers first**

Required env vars:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

- [ ] **Step 4: Add extension points for supported config-file readers**

Constraint:
- only official API-key style sources are allowed
- do not read consumer web-session cookies or app-session tokens

- [ ] **Step 5: Run the credential-resolution test**

Run:

```bash
cd /Users/dylanvu/token-burner
npm run test -- --run tests/unit/resolve-credentials.test.ts
```

Expected:
- PASS

- [ ] **Step 6: Commit**

Run:

```bash
cd /Users/dylanvu/token-burner
git add packages/agent-cli/src/providers tests/unit/resolve-credentials.test.ts
git commit -m "feat: add local provider credential discovery"
```

### Task 12: Implement burn start, owner-token auth, and stale-burn interruption

**Files:**
- Create: `/Users/dylanvu/token-burner/apps/site/src/app/api/burns/start/route.ts`
- Modify: `/Users/dylanvu/token-burner/apps/site/src/lib/server/auth.ts`
- Modify: `/Users/dylanvu/token-burner/apps/site/src/lib/server/housekeeping.ts`
- Create: `/Users/dylanvu/token-burner/tests/integration/start-burn-route.test.ts`
- Test: `/Users/dylanvu/token-burner/tests/integration/start-burn-route.test.ts`

- [ ] **Step 1: Write the failing start-burn test**

Example assertions:

```ts
expect(response.status).toBe(201)
expect(body.status).toBe("running")
expect(body.burnId).toBeDefined()
expect(body.burnSessionToken).toMatch(/^tb_burn_/)
```

- [ ] **Step 2: Implement `POST /api/burns/start`**

Required request fields:
- `ownerToken`
- `provider`
- `targetTokens`
- `presetId` nullable

Required behavior:
- authenticate via owner token
- enforce one active burn per human
- interrupt stale running burns before creating a new one
- create burn-session token scoped to one burn

- [ ] **Step 3: Implement stale-burn housekeeping**

Required rule:
- if `status = running` and `last_heartbeat_at` is older than `STALE_BURN_TIMEOUT_SECONDS`, treat the burn as interrupted

- [ ] **Step 4: Run the start-burn route test**

Run:

```bash
cd /Users/dylanvu/token-burner
npm run test -- --run tests/integration/start-burn-route.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

Run:

```bash
cd /Users/dylanvu/token-burner
git add apps/site/src/app/api/burns/start apps/site/src/lib/server/auth.ts apps/site/src/lib/server/housekeeping.ts tests/integration/start-burn-route.test.ts
git commit -m "feat: add burn start and stale-burn handling"
```

### Task 13: Implement provider adapters, hard-cap math, and parent-session death handling

**Files:**
- Create: `/Users/dylanvu/token-burner/packages/agent-cli/src/providers/openai.ts`
- Create: `/Users/dylanvu/token-burner/packages/agent-cli/src/providers/anthropic.ts`
- Create: `/Users/dylanvu/token-burner/packages/agent-cli/src/runtime/compute-safe-request.ts`
- Create: `/Users/dylanvu/token-burner/packages/agent-cli/src/runtime/parent-watch.ts`
- Create: `/Users/dylanvu/token-burner/packages/agent-cli/src/runtime/run-burn.ts`
- Create: `/Users/dylanvu/token-burner/tests/unit/compute-safe-request.test.ts`
- Create: `/Users/dylanvu/token-burner/tests/unit/parent-watch.test.ts`
- Create: `/Users/dylanvu/token-burner/tests/integration/run-burn.test.ts`
- Test: `/Users/dylanvu/token-burner/tests/unit/compute-safe-request.test.ts`
- Test: `/Users/dylanvu/token-burner/tests/unit/parent-watch.test.ts`
- Test: `/Users/dylanvu/token-burner/tests/integration/run-burn.test.ts`

- [ ] **Step 1: Write the failing cap-math test**

Example assertions:

```ts
expect(computeSafeRequest({ remainingBudget: 500, estimatedInput: 300, safetyMargin: 128 }).maxOutputTokens).toBeLessThanOrEqual(72)
expect(computeSafeRequest({ remainingBudget: 100, estimatedInput: 120, safetyMargin: 0 }).shouldStop).toBe(true)
```

- [ ] **Step 2: Write the failing parent-watch test**

Example assertions:

```ts
expect(await shouldExitWhenParentMissing(fakePidChecker, 1234)).toBe(true)
expect(await shouldExitWhenParentMissing(fakePidChecker, process.pid)).toBe(false)
```

- [ ] **Step 3: Write the failing burn-loop integration test**

Example assertions:

```ts
expect(result.finalStatus).toBe("completed")
expect(result.billedTokensConsumed).toBeLessThanOrEqual(result.requestedBilledTokenTarget)
expect(result.telemetryCalls).toBeGreaterThan(0)
```

- [ ] **Step 4: Implement provider adapters**

Required adapter result fields:
- `billedTokens`
- `inputTokens`
- `outputTokens`
- `rawUsage`

- [ ] **Step 5: Implement the burn loop**

Required behavior:
- resolve local credentials
- start the burn via site API
- compute safe request sizes
- call provider APIs directly
- stop if the parent agent session disappears
- never exceed the target

- [ ] **Step 6: Run all burn-runtime tests**

Run:

```bash
cd /Users/dylanvu/token-burner
npm run test -- --run tests/unit/compute-safe-request.test.ts
npm run test -- --run tests/unit/parent-watch.test.ts
npm run test -- --run tests/integration/run-burn.test.ts
```

Expected:
- all tests pass

- [ ] **Step 7: Commit**

Run:

```bash
cd /Users/dylanvu/token-burner
git add packages/agent-cli/src/runtime packages/agent-cli/src/providers tests/unit/compute-safe-request.test.ts tests/unit/parent-watch.test.ts tests/integration/run-burn.test.ts
git commit -m "feat: add local burn execution runtime"
```

## Chunk 6: Telemetry, Public Updates, and End-to-End Flow

### Task 14: Implement heartbeat, telemetry, and finish endpoints

**Files:**
- Create: `/Users/dylanvu/token-burner/apps/site/src/app/api/burns/[burnId]/heartbeat/route.ts`
- Create: `/Users/dylanvu/token-burner/apps/site/src/app/api/burns/[burnId]/events/route.ts`
- Create: `/Users/dylanvu/token-burner/apps/site/src/app/api/burns/[burnId]/finish/route.ts`
- Modify: `/Users/dylanvu/token-burner/packages/agent-cli/src/api/client.ts`
- Modify: `/Users/dylanvu/token-burner/packages/agent-cli/src/runtime/run-burn.ts`
- Create: `/Users/dylanvu/token-burner/tests/integration/burn-telemetry-routes.test.ts`
- Test: `/Users/dylanvu/token-burner/tests/integration/burn-telemetry-routes.test.ts`

- [ ] **Step 1: Write the failing telemetry-route test**

Example assertions:

```ts
expect(heartbeat.status).toBe(200)
expect(eventPost.status).toBe(202)
expect(finish.status).toBe(200)
```

- [ ] **Step 2: Implement `heartbeat`, `events`, and `finish` routes**

Required auth primitive:
- burn-session token issued by `start`

Required updates:
- `last_heartbeat_at`
- `billed_tokens_consumed`
- `burn_events` rows
- final burn status

- [ ] **Step 3: Wire the CLI runtime to submit**

- heartbeats while running
- usage events after every provider step
- final completion/interruption notification

- [ ] **Step 4: Run the telemetry-route test**

Run:

```bash
cd /Users/dylanvu/token-burner
npm run test -- --run tests/integration/burn-telemetry-routes.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

Run:

```bash
cd /Users/dylanvu/token-burner
git add apps/site/src/app/api/burns packages/agent-cli/src/api packages/agent-cli/src/runtime tests/integration/burn-telemetry-routes.test.ts
git commit -m "feat: add burn telemetry endpoints"
```

### Task 15: Add end-to-end coverage for the full website-plus-agent flow

**Files:**
- Create: `/Users/dylanvu/token-burner/tests/e2e/agent-onboarding-and-burn.spec.ts`
- Modify: `/Users/dylanvu/token-burner/README.md`
- Test: `/Users/dylanvu/token-burner/tests/e2e/agent-onboarding-and-burn.spec.ts`

- [ ] **Step 1: Write the end-to-end test**

Required flow:
- load homepage
- generate claim code
- read prompt block
- run CLI `register` against a local test server
- run CLI `burn` with mocked provider responses
- observe public burn page update
- observe leaderboard update

- [ ] **Step 2: Add any missing test seams**

Allowed seams:
- mocked provider HTTP transport
- temporary HOME directory for local config
- temporary database

- [ ] **Step 3: Update `README.md` with real local commands**

Required commands to document:

```bash
npm install
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npx -y @shirtlessfounder/token-burner-agent register --claim-code <code> --handle <handle> --avatar <emoji-or-url>
npx -y @shirtlessfounder/token-burner-agent burn --provider openai --tokens 500000
```

- [ ] **Step 4: Run the e2e test**

Run:

```bash
cd /Users/dylanvu/token-burner
npm run test:e2e -- tests/e2e/agent-onboarding-and-burn.spec.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

Run:

```bash
cd /Users/dylanvu/token-burner
git add tests/e2e/agent-onboarding-and-burn.spec.ts README.md
git commit -m "test: cover agent-first burn flow"
```

## Chunk 7: Deployment, Package Publish, and Forge Swarm Bring-Up

### Task 16: Deploy the public site and publish the CLI package

**Files:**
- Modify: `/Users/dylanvu/token-burner/apps/site/package.json`
- Modify: `/Users/dylanvu/token-burner/packages/agent-cli/package.json`
- Modify: `/Users/dylanvu/token-burner/docs/ops/INFRASTRUCTURE.md`
- Test: Vercel deployment and `npx` package resolution

- [ ] **Step 1: Set final package names and publish metadata**

Required:
- site package stays private
- CLI package gets a public npm name suitable for `npx`

- [ ] **Step 2: Add package publish instructions to `docs/ops/INFRASTRUCTURE.md`**

Document:
- npm auth prerequisite
- version bump process
- `npm publish --workspace <cli-package> --access public`

- [ ] **Step 3: Deploy the site to Vercel**

Run:

```bash
cd /Users/dylanvu/token-burner/apps/site
npx vercel deploy --prod
```

Expected:
- production deployment succeeds

- [ ] **Step 4: Publish the CLI package**

Run:

```bash
cd /Users/dylanvu/token-burner
npm publish --workspace <cli-package-name> --access public
```

Expected:
- package resolves publicly for `npx`

- [ ] **Step 5: Smoke test the zero-install entrypoint**

Run:

```bash
npx -y <cli-package-name> --help
```

Expected:
- help output renders successfully without a global install

- [ ] **Step 6: Commit any publish/deploy doc changes**

Run:

```bash
cd /Users/dylanvu/token-burner
git add apps/site/package.json packages/agent-cli/package.json docs/ops/INFRASTRUCTURE.md
git commit -m "build: prepare site deploy and cli publish"
```

### Task 17: Run full verification and bring up the initial Forge swarm

**Files:**
- Modify: `/Users/dylanvu/token-burner/docs/product/delivery-plan.md`
- Test: full repo verification and Forge startup state

- [ ] **Step 1: Run the full verification suite**

Run:

```bash
cd /Users/dylanvu/token-burner
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Expected:
- all commands pass

- [ ] **Step 2: Push the verified baseline**

Run:

```bash
cd /Users/dylanvu/token-burner
git push origin main
```

Expected:
- GitHub repo matches the verified baseline

- [ ] **Step 3: Start the initial Forge swarm**

Run:

```bash
cd /Users/dylanvu/Forge
uv run forge add planner worker worker
uv run forge apply
uv run forge status
```

Expected:
- one planner and two workers are staged/applied against `shirtlessfounder/token-burner`

- [ ] **Step 4: Watch the planner claim the epic and create child issues**

Run:

```bash
cd /Users/dylanvu/Forge
uv run forge logs -f
```

Expected:
- planner picks up the epic issue
- planner creates worker-sized issues against the new repo

- [ ] **Step 5: Add the super agent only once review traffic exists**

Run:

```bash
cd /Users/dylanvu/Forge
uv run forge add super --apply
uv run forge status
```

Expected:
- super is added only after planner/worker review flow exists

## Delivery Notes

- This plan intentionally removes every hosted-key and hosted-worker assumption from the previous version. The website is public and mostly read-only; the local CLI package is the execution boundary.
- Do not add human web auth to v1 unless a later product decision changes the model.
- Do not use `AgentMeets` in this implementation. The product needs persistent human identity, reusable owner tokens, and burn telemetry, not agent-to-agent chat rooms.
- Keep the local runtime env-first. Config-file discovery is allowed only for explicit official API-key style paths and must never read browser session cookies or consumer app tokens.
- The hard-cap invariant matters more than exact equality at the target. Under-run is acceptable; overrun is not.
- The start-burn route must interrupt stale burns before denying a new one, otherwise a dead local agent could permanently strand a human in `running`.
- Once Chunk 1 is complete, the planner should break the remaining chunks into worker-sized issues rather than asking one worker to execute giant end-to-end slices.

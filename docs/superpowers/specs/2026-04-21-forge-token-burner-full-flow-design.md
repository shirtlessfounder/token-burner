# Forge Full-Flow Bring-Up for Token Burner

## Summary

Bring `Forge` online against `shirtlessfounder/token-burner` using the existing v1 delivery epic, with Chunk 1 treated as complete and planner-driven decomposition starting at Chunk 2.

The goal is to let Forge decide task breakdown within a controlled lane, not to pre-split the whole roadmap by hand. The first run should establish the missing GitHub coordination labels, keep issue `#1` as the single parent epic, and let the planner create only the next dependency-respecting worker issues for shared contracts and database/runtime foundations.

## Context

- `token-burner` already has Chunk 1 bootstrap complete:
  - repo scaffolded
  - Vercel + Supabase linked
  - product and infra docs committed
  - parent epic `#1` already open in GitHub
- `Forge` is already configured to target `github.com/shirtlessfounder/token-burner`
- applied swarm currently includes `planner-01` plus three workers
- `token-burner` currently only has the bootstrap labels:
  - `type:epic`
  - `role:planner`
  - `status:ready-for-planning`
- full worker lifecycle labels are still missing, so planner/worker execution cannot safely start yet

## Decision

Use one top-level epic for the whole v1 rollout and let the planner incrementally decompose the next executable slice.

Do not create one epic per delivery-plan chunk. Do not explode the entire remaining backlog into issues on the first run.

## Why This Shape

### Recommended approach

Keep GitHub issue `#1` as the only parent epic for the v1 build and let the planner decompose work incrementally from `docs/product/delivery-plan.md`.

This matches Forge's intended lifecycle:

1. human opens a planner-owned epic
2. planner claims it and scopes the next slice
3. workers implement ready tasks
4. planner reviews handoffs and controls additional decomposition
5. super is added later once review traffic exists

### Alternatives considered

#### One epic per chunk

Pros:

- easier phase-level visibility
- cleaner manual reporting by chunk

Cons:

- more planner/admin overhead
- more dependency management across epics
- encourages artificial boundaries where schema, APIs, and CLI work actually cross-cut

#### Full upfront backlog decomposition

Pros:

- maximum initial visibility
- more tasks immediately available

Cons:

- high risk of stale or out-of-order worker issues
- planners must guess too much before upstream contracts land
- likely to create speculative UI and CLI tasks before foundations are stable

## Execution Model

### Epic strategy

- keep issue `#1` as the single parent epic
- treat Chunk 1 as complete
- use the epic comment thread to communicate the new execution lane:
  - Chunk 1 is done
  - planner intake starts at Chunk 2
  - first planning wave should create Task 4 now and, at most, record blocked Task 5A follow-up work
- first planner intake is triggered by running `planner-01` directly so the runtime pre-assigns issue `#1`; do not rely on passive cron polling as the initial claim mechanism

### First planner wave

The planner should start at Chunk 2 and create a small dependency-respecting backlog:

- `Wave 1A`: Task 4, shared contracts and workspace tooling
- `Wave 1B`: Task 5A foundation, recorded for follow-up but not worker-ready yet

On the first planner pass:

- create at most one worker-ready issue for Task 4
- do not create a worker-ready Task 5A issue yet
- create no more than one total `status:ready-for-work` issue
- do not create any issue that mixes Task 4 and Task 5 acceptance criteria
- do not create a planner-owned `status:planning` follow-up issue on the first pass; if a decomposition ambiguity is discovered, treat it as a hard blocker, use the `Hard blocker:` comment contract, and stop

The only valid no-child first pass is a hard-blocker pass, such as missing GitHub permissions or an unreadable repo state. Otherwise the planner is expected to emit the Task 4 worker issue.

Hard-blocker contract for the first pass:

- epic `#1` becomes `type:epic`, `role:planner`, `status:blocked`
- no child issues are created
- epic `#1` receives a comment beginning with `Hard blocker:` and naming the blocking condition plus the required admin action
- epic body and checklist remain unchanged until the blocker is cleared

The planner should avoid:

- UI/homepage issues from Chunk 3 before shared contracts and schema exist
- CLI execution issues from Chunks 4 and 5 before owner-token auth and burn persistence foundations exist
- full-backlog decomposition across Chunks 3 through 7 on first intake

### First-wave label contract

Required labels for planner-created issues in the initial intake wave:

| Issue kind | Required labels | Who sets them | When |
|------------|-----------------|---------------|------|
| Parent epic `#1` before claim | `type:epic`, `role:planner`, `status:ready-for-planning` | Human/admin | Before planner run |
| Parent epic `#1` after planner claim | `type:epic`, `role:planner`, `status:planning` | Planner | Immediately after claim |
| Worker task created for Task 4 | `type:task`, `role:worker`, `status:ready-for-work` | Planner | When the issue is executable now |
| Later-pass worker task created for Task 5 foundation | `type:task`, `role:worker`, `status:ready-for-work` | Planner | Only after Task 4 is merged |
| Deferred downstream issue blocked on foundation landing | `type:task`, `role:planner`, `status:blocked` | Planner | Only when the planner wants to record the next slice without making it worker-ready |

For the first intake wave, no child issue should be created without one of the label combinations above.

### Canonical first-pass outputs

The expected first planner pass creates exactly these child outputs:

1. one Task 4 worker issue labeled `type:task`, `role:worker`, `status:ready-for-work`
2. optionally one Task 5A placeholder labeled `type:task`, `role:planner`, `status:blocked`

No other child issue shapes are allowed on the first pass.

If the planner creates the optional Task 5A placeholder, it must:

- include `Parent: #1` in the issue body
- use a title that makes the dependency explicit, such as `Task 5A foundation after Task 4 merge`
- contain only a short summary of the deferred Task 5A scope
- avoid file-level implementation breakdown before Task 4 lands

Canonical blocked Task 5A placeholder body:

```md
Parent: #1

Blocked until Task 4 shared contracts merge.

Deferred scope:
- Task 5A schema foundation for burns, burn presets, auth helpers, and stale-burn housekeeping
```

Blocked planner-owned placeholders do not need a `Target branch:` field until they are promoted to worker-ready issues.

### Task boundary contract

Task 4 owns:

- root workspace wiring needed for shared contracts
- `packages/shared`
- shared API schemas
- shared domain enums and types
- tests proving those contracts parse and reject invalid input

### Canonical Task 4 worker template

The first-pass Task 4 worker issue is valid only if it targets this shape:

It includes:

- `/Users/dylanvu/token-burner/package.json`
- `/Users/dylanvu/token-burner/tsconfig.base.json`
- `/Users/dylanvu/token-burner/packages/shared/package.json`
- `/Users/dylanvu/token-burner/packages/shared/src/api.ts`
- `/Users/dylanvu/token-burner/packages/shared/src/domain.ts`
- `/Users/dylanvu/token-burner/packages/shared/src/index.ts`
- `/Users/dylanvu/token-burner/tests/unit/shared-api.test.ts`

It excludes:

- database schema or migration files
- site UI files
- API route files
- CLI runtime files

Minimum acceptance criteria:

- shared request/response schemas exist for claim codes, register/link flows, burn start, heartbeat, telemetry, and burn finish
- shared domain enums exist for provider, burn status, and preset IDs
- `npm run test -- --run tests/unit/shared-api.test.ts` passes
- `npm run typecheck` passes

Task 5 decomposes into two fixed subunits:

- Task 5A: schema, migrations, DB client, owner-token verification, claim-code validation, stale-burn helpers, and schema/invariant integration tests
- Task 5B: query layer and public selectors for homepage, leaderboards, profiles, and burn pages

The interface between them is:

- Task 4 defines the canonical request/response and domain contracts
- Task 5A consumes those domain concepts when naming persisted enums, statuses, and validation-adjacent helpers
- Task 5A must not redefine provider IDs, burn statuses, preset IDs, or any other shared domain enum/value independently
- Task 4 merge is the prerequisite for any Task 5A worker-owned issue; before Task 4 lands, the planner may only record Task 5A as a planner-owned `status:blocked` follow-up
- Task 5B depends on Task 5A landing first

### Later Task 5A worker template

Once Task 4 is merged, the canonical first Task 5A worker issue is the Task 5A foundation slice.

It includes:

- `drizzle/0001_initial.sql`
- `apps/site/src/lib/db/schema.ts`
- `apps/site/src/lib/db/client.ts`
- `burn_presets` persistence needed for preset-backed burns
- minimal owner-token verification and claim-code validation helpers in `apps/site/src/lib/server/auth.ts`
- minimal stale-burn interruption helpers in `apps/site/src/lib/server/housekeeping.ts`
- `tests/integration/db-schema.test.ts`

It excludes:

- public selectors in `apps/site/src/lib/db/queries.ts`
- homepage/profile/burn lookup query shaping
- any UI or route work
- any burn execution logic from later chunks

Minimum acceptance criteria:

- initial migration and schema land for humans, agent installations, claim codes, owner tokens, burns, and burn events
- `burn_presets` persistence lands as part of the preset-backed burns model
- DB client exists
- owner-token verification and claim-code validation helpers exist
- stale-burn interruption helper exists
- one-active-burn invariant is enforced with the required partial unique index on active burn statuses
- at least one integration assertion covers rejecting a second active burn for the same human
- `npm run test -- --run tests/integration/db-schema.test.ts` passes
- `npm run typecheck` passes

Verification:

```bash
cd /Users/dylanvu/token-burner
npm run test -- --run tests/integration/db-schema.test.ts
npm run typecheck
```

Helper interface contract:

- `auth.ts` exposes owner-token verification and claim-code validation primitives consumed by later agent/authenticated routes
- `housekeeping.ts` exposes stale-burn interruption primitives used to enforce one-active-burn behavior before new burn starts
- neither helper module owns route logic or public query shaping

`burn_presets` schema contract:

- table name: `burn_presets`
- required columns: `id`, `provider`, `label`, `requested_billed_token_target`, `sort_order`, `is_active`
- `burns.preset_id` references `burn_presets.id`
- presets are editable product content, not UI-hardcoded constants

When Task 4 merges, the planner should promote the existing blocked Task 5A placeholder in place by:

- editing its labels from `role:planner` + `status:blocked` to `role:worker` + `status:ready-for-work`
- rewriting the body so it contains the full Task 5A worker template, not the short blocked-placeholder summary
- adding `Target branch: <epic-branch-name>` to the promoted worker issue body
- updating the title if needed so it describes executable Task 5A foundation work rather than deferred work

Do not close and replace it with a duplicate issue.

Authoritative promotion trigger:

- Task 4 child issue is `status:done`
- Task 4 child PR is merged into the epic branch

If no blocked Task 5A placeholder exists when Task 4 merges, the planner should create a new Task 5A worker issue directly from the canonical Task 5A worker template above.

### Later Task 5B worker template

Once Task 5A is complete, the planner may create a Task 5B worker issue for:

- `apps/site/src/lib/db/queries.ts`
- `/Users/dylanvu/token-burner/tests/integration/db-queries.test.ts`
- public selector shaping for homepage, leaderboards, profiles, and burn pages

It excludes:

- route handlers
- page components
- burn execution logic
- schema or migration edits unless required only for selector correctness

Interface contract:

- `queries.ts` exposes selector helpers that later page and route surfaces will call
- Task 5B defines the query layer only; it does not build the consuming pages or routes

Minimum acceptance criteria:

- query helpers exist for homepage live burns
- query helpers exist for provider-split daily, weekly, and all-time leaderboards
- query helpers exist for public profile lookup by handle
- query helpers exist for public burn lookup by burn ID
- `tests/integration/db-queries.test.ts` covers those selectors at least once

Verification:

```bash
cd /Users/dylanvu/token-burner
npm run test -- --run tests/integration/db-queries.test.ts
npm run typecheck
```

Task 5B should be a new worker issue rather than a mutation of the old Task 5A issue.

Authoritative Task 5B creation trigger:

- Task 5A child issue is `status:done`
- Task 5A child PR is merged into the epic branch

### Backlog sizing

The initial pass may leave one worker idle. Do not create speculative work just to use all workers.

The planner should prefer under-production over speculative decomposition.

## Swarm Shape

Start with:

- `planner-01`
- `worker-01`
- `worker-02`

Do not run:

- `worker-03`
- `super`

Rationale:

- the delivery plan's initial Forge bring-up uses one planner and two workers
- adding a third worker before the planner proves the lane increases coordination noise without increasing throughput
- `super` should only appear once real review traffic exists

### Swarm normalization step

The currently applied swarm includes `worker-03`. Normalize the applied set before planner intake:

```bash
cd /Users/dylanvu/Forge
uv run forge rm worker-03
uv run forge apply
uv run forge status
```

Expected result:

- applied swarm shows only `planner-01`, `worker-01`, and `worker-02`

### First intake trigger

Use an explicit planner run for the first claim/decomposition cycle:

```bash
cd /Users/dylanvu/Forge
uv run forge run planner-01
uv run forge logs planner-01 -n 200
```

Expected signal:

- preflight locks issue `#1`
- planner log shows `ASSIGNED_ISSUE: 1` or equivalent pickup of epic `#1`
- epic `#1` moves from `status:ready-for-planning` to `status:planning`

## Admin Preparation

Before the first planner run, complete the GitHub coordination surface:

### Required labels to add

Status:

- `status:planning`
- `status:ready-for-work`
- `status:in-progress`
- `status:needs-review`
- `status:blocked`
- `status:done`

Role:

- `role:worker`
- `role:super`
- `role:admin`

Type:

- `type:task`
- `type:fix`

Keep the existing labels in place:

- `type:epic`
- `role:planner`
- `status:ready-for-planning`

### Epic annotation

Post an admin comment on issue `#1` stating:

- Chunk 1 bootstrap is complete
- planner intake begins at Chunk 2
- first decomposition wave should create a Task 4 worker-ready issue now and, at most, a blocked Task 5A follow-up

After that, let the planner claim the epic and move it from `status:ready-for-planning` to `status:planning`.

### Execution surface

The admin preparation is executed from the terminal with GitHub CLI against `shirtlessfounder/token-burner`.

Source of truth:

- label taxonomy: `/Users/dylanvu/Forge/contexts/LABELS.md`
- epic/subtask linking rule: `/Users/dylanvu/Forge/contexts/ISSUES.md`
- planner branch/parent-PR contract: `/Users/dylanvu/Forge/contexts/PLANNER.md`
- worker target-branch/worktree contract: `/Users/dylanvu/Forge/contexts/WORKSPACE.md`
- canonical epic body: `/Users/dylanvu/token-burner/docs/product/epic-issue.md`
- work sequencing: `/Users/dylanvu/token-burner/docs/product/delivery-plan.md`

Before the first planner run, normalize epic `#1` so its body matches `/Users/dylanvu/token-burner/docs/product/epic-issue.md`.

This full body reset is first-run-only; do not rerun it after the planner has started maintaining the `## Subtasks` checklist.

Rerunnable admin actions:

```bash
for spec in \
  "status:planning|BFDADC|Being broken down into sub-tasks" \
  "status:ready-for-work|BFDADC|Ready for a worker to claim" \
  "status:in-progress|FBCA04|Claimed and actively being worked on" \
  "status:needs-review|5319E7|PR open, awaiting review" \
  "status:blocked|D93F0B|Blocked on a dependency or issue" \
  "status:done|0E8A16|Completed and merged" \
  "role:worker|1D76DB|Should be picked up by a worker agent" \
  "role:super|C2E0C6|Needs super agent review" \
  "role:admin|5319E7|Requires human admin action" \
  "type:task|FEF2C0|Standard work item" \
  "type:fix|D4C5F9|Bug fix or corrective follow-up"
do
  IFS='|' read -r name color desc <<< "$spec"
  gh api repos/shirtlessfounder/token-burner/labels --paginate --jq '.[].name' | rg -Fxq "$name" \
    || gh label create "$name" --color "$color" --description "$desc" -R shirtlessfounder/token-burner
done
CONTROL_COMMENT="Chunk 1 bootstrap is complete. Planner intake now starts at Chunk 2 of docs/product/delivery-plan.md. First decomposition wave: Task 4 worker-ready now, with at most a blocked Task 5A follow-up."
gh api repos/shirtlessfounder/token-burner/issues/1/comments --paginate --jq '.[].body' \
  | rg -Fxq "$CONTROL_COMMENT" \
  || gh issue comment 1 -R shirtlessfounder/token-burner --body "$CONTROL_COMMENT"
```

First-run-only normalization:

```bash
gh issue edit 1 -R shirtlessfounder/token-burner --body-file /Users/dylanvu/token-burner/docs/product/epic-issue.md
```

## Operational Guardrails

- if the planner creates more than one worker-ready issue on first pass, treat that as overproduction
- if the planner creates UI or CLI execution tasks before Task 4 and Task 5 foundations land, treat that as bad scoping
- if workers sit idle because only one worker-ready issue exists, do not force speculative tasks just to raise utilization
- add `super` only after the planner/worker loop has produced real PR review traffic
- the blocked Task 5A placeholder is a dormant record only; it is not intake-eligible until the planner explicitly promotes it or creates a new worker issue after Task 4 merges

## Failure Handling

- if label creation or issue edits fail, stop before any agent run; resolve GitHub auth/permission problems first
- if the planner does not claim epic `#1` within 4 minutes of the normalized swarm being applied, run:

```bash
cd /Users/dylanvu/Forge
uv run forge run planner-01
uv run forge logs planner-01 -n 200
```

  Expected success signal:
  - the log shows planner intake against `shirtlessfounder/token-burner`
  - epic `#1` is claimed or a concrete error is visible

  Canonical log location:
  - `/Users/dylanvu/Forge/agent-kernel/logs/planner-01.log`

  Only change scope after a concrete planner error is observed.
- if the first pass hits a hard blocker, verify the hard-blocker contract above, clear the blocker, and rerun `planner-01` without changing the epic body or inventing interim child issues
- if the planner creates valid child issues but fails to create the epic branch, open the parent PR, or stamp the target branch into child issues, stop worker intake until the planner repairs those branch/PR metadata gaps and rerun `planner-01`
- if the planner claims `#1` but does not create valid child issues or update the epic body/checklist, reset the epic to a known intake state before rerunning:

```bash
gh issue edit 1 -R shirtlessfounder/token-burner --remove-label status:planning --add-label status:ready-for-planning
```

  Then restore child issue state to this known rerun contract before rerunning:
  - preserve an already-valid Task 4 child issue if it matches the first-pass contract; do not close and recreate it
  - close any malformed worker-ready Task 5A issue
  - close any child issue outside Task 4 scope or the optional blocked Task 5A placeholder
  - if a valid Task 4 issue already exists, update epic `#1` checklist/body to reference that existing issue instead of generating a duplicate
  - if epic `#1` body content outside `## Subtasks` drifted, restore only the non-`## Subtasks` portion from `/Users/dylanvu/token-burner/docs/product/epic-issue.md` while preserving the existing valid `## Subtasks` section
  - remove malformed checklist entries from epic `#1`
  - keep a correctly labeled blocked Task 5A placeholder only if it matches the canonical first-pass outputs above

  After cleanup, restate the intake scope in an issue comment if needed and rerun `planner-01`
- if the planner creates out-of-order issues, close or relabel the bad issues, comment on `#1` with the tighter scope, and let the planner re-run
- if a worker claims an issue but produces no PR, no handoff comment, and no meaningful progress comment within 10 minutes, the planner resets it with `gh issue edit <number> --remove-label status:in-progress --add-label status:ready-for-work` and adds a short stale-claim comment

## Verification Gates

### Before first planner run

- full Forge label set exists on `shirtlessfounder/token-burner`
- epic `#1` body still matches `/Users/dylanvu/token-burner/docs/product/epic-issue.md` and points at the repo-local source-of-truth docs
- issue `#1` has the admin comment marking Chunk 1 complete and steering the first wave to Task 4 now, with at most a blocked Task 5A follow-up
- applied swarm is exactly:
  - `planner-01`
  - `worker-01`
  - `worker-02`
- polling readiness is verified with:

```bash
cd /Users/dylanvu/Forge
uv run forge status
```

  Expected signal:
  - the normalized swarm appears under `Applied agents`
  - no pending staged/apply mismatch remains for the first-run configuration

### After first planner run

If the run was a hard-blocker pass:

- epic `#1` moves to `status:blocked`
- no child issues exist
- epic `#1` has the required `Hard blocker:` comment
- epic body/checklist remain unchanged

If the run was a normal first pass:

- epic `#1` moves to `status:planning`
- planner creates an epic branch off `main`
- planner opens a parent PR from that epic branch to `main`
- each child issue includes `Parent: #1` in the issue body, not only in comments
- each worker-ready child issue specifies the epic branch as the worker PR target branch
- each child issue label set matches the first-wave label contract above
- epic `#1` body is updated with a subtask checklist referencing the new child issues
- first child issues only map to Task 4 scope plus, if needed, a planner-owned blocked Task 5A placeholder
- no `super` lane is active yet

### Before adding `super`

- at least one worker PR plus planner handoff/review cycle exists
- review traffic is real, not just issue creation

## Startup Mode

First bring-up uses an explicit `uv run forge run planner-01` intake run.

Cron-driven polling is steady-state mode after that initial claim/decomposition succeeds, and it is considered ready once `uv run forge status` shows the normalized applied swarm and no pending staged/apply mismatch.

Webhook setup is useful later, but it should not block the initial bring-up. The first success condition is a planner claiming the epic and creating correctly scoped child issues through the explicit first-run trigger defined above.

## Epic Checklist Format

The canonical body in `/Users/dylanvu/token-burner/docs/product/epic-issue.md` should conform to the Forge epic intake shape from `/Users/dylanvu/Forge/contexts/ISSUES.md`.

When the planner updates epic `#1` after decomposition, it should preserve the canonical body from `/Users/dylanvu/token-burner/docs/product/epic-issue.md` and append a `## Subtasks` section in this shape:

```md
## Subtasks
- [ ] #<issue-number> — <short task title>
```

Only append checklist lines for currently valid child issues that remain open after the planner run.

## Worker Issue Body Format

Worker-ready child issues should use this body shape:

```md
Parent: #1
Target branch: <epic-branch-name>

## Scope
- <what the worker owns>

## Exclusions
- <what the worker must not touch>

## Acceptance Criteria
- <independently verifiable outcome>
```

Minimum branch invariant:

- planner creates one epic branch off `main`
- planner opens one parent PR from that branch to `main`
- every worker-ready child issue names that epic branch as its target branch

## Out of Scope for This Spec

- webhook monitor setup
- adding `super` before planner/worker review traffic exists
- chunk-by-chunk epic restructuring
- planning or decomposing later chunks beyond what is needed for the first safe intake wave

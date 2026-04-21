# Token Burner Product Design

## Goal

Build a public website called `token-burner` at `/Users/dylanvu/token-burner` where humans publicly waste their own AI API tokens for spectacle, status, and leaderboard position, but the burns are started and executed from their CLI agents rather than from the website itself.

The first version should feel like a luxury absurdist performance venue, not a productivity tool. The core loop is:

1. visit the public site
2. copy the canonical prompt and claim code into a CLI agent
3. let the agent register or link the human identity
4. start a live ceremonial burn from the CLI agent
5. climb the leaderboard on the public site

## Product Mode

The product is an art piece first.

- open public website
- public status competition
- no platform fee at launch
- no cost estimates in the UX
- leaderboard-driven class signaling rather than invite gating
- website is primarily a stage and onboarding surface, not a logged-in app

## Product Boundaries

### In scope

- standalone new app, separate from existing repos
- public website with no human site login in v1
- one-time website claim codes for first-time human registration
- canonical public onboarding prompt and `skill.md` for CLI agents
- agent-driven first-time identity creation
- handle and avatar setup inside the CLI agent during first claim
- reusable owner token stored locally and reused across linked agents
- one human identity owning many agent installations
- OpenAI and Anthropic support at launch
- text-model burns only in v1
- one fixed flagship model per provider in v1
- preset burn tiers plus custom token target
- live public burn feed
- daily, weekly, and all-time leaderboards
- provider-split leaderboards
- fully agent-driven burn start flow
- final public burn records with metadata and final totals
- website on Vercel
- Supabase for public state, human identities, claim codes, burn telemetry, and leaderboard data
- local agent/runtime uses official provider credentials on the user machine

### Out of scope

- scraping or extracting session tokens from consumer web apps like Claude or ChatGPT
- unofficial or bypass auth flows
- provider OAuth unless a provider later exposes an official end-user API flow that fits this use case
- image or audio generation burns in v1
- spectator comments, reactions, or duels in v1
- public raw nonsense output stream in v1
- storing provider API keys on the website
- human website sign-in in v1
- hosted burn execution worker on exe.dev in v1
- browser-started burns in v1
- multiple simultaneous burns per human in v1
- app-level money budgeting or spend estimates

## User Outcome

The human wants to publicly perform waste without trusting a website with their provider keys.

They are not trying to get useful work done. They want a fast path from seeing the public spectacle to sending their CLI agent into a ridiculous token-burning ceremony, with the result preserved as prestige on a leaderboard.

## Core Product Rules

### Identity

- there is no normal website account login in v1
- the primary owner is a human identity, not an agent identity
- many agent installations can roll up to one human identity
- first-time human identity creation starts from a one-time claim code shown on the public website
- handle and avatar are chosen in the CLI agent during registration
- the agent stores a reusable owner token locally and reuses it on later burns or later linked agents

### Agent onboarding

- the website shows a canonical prompt for CLI agents
- the agent reads a public `skill.md` or equivalent bootstrap document
- first-time flow:
  - exchange website claim code
  - create human identity
  - choose handle/avatar
  - receive reusable owner token
- repeat flow:
  - reuse stored owner token
  - optionally link another agent installation to the same human identity

### Provider credentials

- provider API keys are not stored on the website
- local runtime checks standard env vars first
- local runtime may also check supported provider-specific local config files
- if supported local credentials are missing, the burn cannot start
- only official provider credential paths are allowed

### Burn creation

- burn is started from the CLI agent, not the website
- user chooses provider
- provider model is fixed by the system for v1
- user chooses either:
  - a preset tier
  - a custom token target
- minimal friction in the CLI flow
- no dollar estimate is shown

### Burn execution

- burns are fully agent-driven in v1
- the local agent/runtime calls provider APIs directly using local credentials
- the public website only receives telemetry and renders state
- raw generated text is not shown in the public experience
- spectators can watch but cannot interact in v1
- if the CLI agent session dies, the burn stops immediately

### Accounting

- counts all billed tokens, not just output tokens
- leaderboard is split by provider because cross-provider token totals are not strictly comparable
- inside each provider, v1 uses one fixed flagship model so the board is internally coherent
- target is a hard cap: never exceed the requested billed-token total
- if exact stopping is uncertain, stop conservatively under the cap

### Public record

- live feed shows currently active burns
- completed records persist:
  - human handle
  - provider
  - timestamp
  - final billed-token total
  - season placement or ranking context
- no full replay timeline in v1

## Visual Direction

The design language should be excessive fashion-house absurdity.

- opulent
- theatrical
- editorial
- intentionally ridiculous
- status-soaked

It should not look like:

- a startup landing page
- a fintech dashboard
- a generic AI tool
- purple gradient SaaS chrome

The homepage should prioritize:

1. leaderboard
2. live burn feed
3. agent onboarding prompt / claim flow

## Architecture

The recommended architecture is a two-boundary system:

1. public website on Vercel
2. Supabase as the shared system of record

The execution boundary for the actual burn lives on the user machine through the CLI agent/runtime, not on hosted infrastructure.

### Runtime topology

- Vercel site:
  - public homepage
  - provider-split leaderboards
  - live burn feed
  - claim-code generation
  - public bootstrap prompt and `skill.md`
  - public profile pages
- Supabase:
  - human identities
  - linked agent installations
  - one-time claim codes
  - owner-token-backed linking records
  - burn state
  - burn telemetry events
  - leaderboard aggregation
  - realtime updates to clients
- Local CLI agent/runtime:
  - reads `skill.md`
  - creates or links the human identity
  - stores owner token locally
  - finds local provider credentials
  - starts burn
  - calls provider APIs directly
  - streams progress and completion telemetry back to the site

## Main Data Model

### `humans`

- id
- public_handle
- avatar_url
- created_at
- moderation flags if needed later

### `agent_installations`

- id
- human_id
- agent_label
- local_machine_label nullable
- created_at
- last_seen_at

### `claim_codes`

- id
- code
- status
- expires_at
- claimed_human_id nullable
- created_at

### `owner_tokens`

- id
- human_id
- token_hash
- created_at
- last_used_at
- revoked_at nullable

The reusable owner token is stored locally on the user machine. The website stores only a safe server-side representation such as a hash or equivalent verification primitive.

### `burns`

- id
- human_id
- agent_installation_id
- provider
- model
- preset_id nullable
- requested_billed_token_target
- billed_tokens_consumed
- status
- started_at
- finished_at
- public_visibility metadata

### `burn_events`

- id
- burn_id
- event_type
- event_payload
- created_at

These exist for public state updates and operational tracing, not for a public raw transcript.

### `leaderboard_rollups`

Could be materialized tables or query-driven views, but the system needs:

- provider
- scope: daily, weekly, all-time
- human_id
- total_billed_tokens
- rank snapshot metadata if precomputed

### `burn_presets`

The preset system should exist as product content, not hardcoded inline in the UI, so theatrical tiers can be edited without redesigning the application.

## Agent Bootstrap Design

The public website should present a canonical onboarding experience that tells the human to paste a prompt into their CLI agent.

### First-time claim flow

1. human visits website
2. website generates a claim code
3. human pastes onboarding prompt into CLI agent
4. agent reads `skill.md`
5. agent exchanges claim code with the site
6. agent asks for handle and avatar
7. site returns or confirms the human identity
8. agent stores reusable owner token locally

### Returning flow

1. human visits site or opens CLI directly
2. agent already has stored owner token
3. agent links or reuses the existing human identity
4. burn can start immediately if local provider credentials are available

## Burn Engine Design

The local runtime should optimize for predictable billed-token consumption, not semantic quality.

### Core loop

1. agent or ephemeral local runtime starts a burn
2. runtime loads fixed provider/model configuration
3. runtime computes remaining safe token budget
4. runtime submits a useless text-generation request directly to the provider API
5. runtime reads billed-token usage returned by the provider
6. runtime posts progress telemetry to the site
7. runtime repeats until another request could risk exceeding the cap
8. runtime stops and marks the burn complete

### Hard-cap behavior

The system promise is:

- never exceed the requested billed-token target
- stopping slightly under target is acceptable

This matters because provider usage reporting and generation steps may make exact last-token stopping impractical. The local runtime should therefore bias toward under-run rather than overrun.

### Failure policy

- if provider usage metadata is missing or ambiguous, stop safely
- if local provider credentials become invalid mid-burn, fail the burn with a visible status
- if the CLI agent session ends, the burn ends immediately

## UX Surfaces

### Homepage

- provider-split daily, weekly, and all-time leaderboards
- active burn feed
- strong luxury brand statement
- public onboarding prompt and claim-code flow

### Onboarding surface

- generate a one-time claim code
- show the canonical prompt to paste into the CLI agent
- link to `skill.md`
- explain that provider keys stay local and are never entered into the website

### Live burn view

- giant counters
- strong motion and theatrical visual treatment
- clear provider badge
- human identity
- status updates
- no public nonsense transcript

### Profile

- public human identity
- cumulative totals
- recent burns
- provider-specific standing

## Anti-Abuse Posture

The launch posture is intentionally light:

- claim codes
- rate limits
- one active burn per human

The system should still include internal operational controls even if they are not central product features:

- suspend a human identity
- revoke an owner token
- reject telemetry from a compromised or malformed local client

## Open Risks And Constraints

### CLI dependency

This design depends on the user being willing and able to use a CLI agent. That is an intentional product choice, but it narrows the audience.

### Local runtime reliability

The strongest trust property in this design comes from not storing provider keys on the website. The tradeoff is that burn execution is no longer hosted or persistent. If the local agent dies, the burn dies.

### Token comparability

Token totals are not a clean universal unit across providers. Provider-split boards solve the main fairness problem for v1. A single cross-provider vanity board is not part of the required design.

### Exact burn stopping

Exact equality at the cap is less important than the invariant that the system never exceeds the target. The product should describe this honestly.

### AgentMeets

`AgentMeets` is intentionally out of the design. It is an agent-to-agent messaging product, not the right abstraction for persistent human identity, reusable owner tokens, local provider credential use, and burn telemetry.

## Success Criteria

The first version succeeds if a new human can:

1. visit the website without logging in
2. generate a claim code
3. paste the onboarding prompt into their CLI agent
4. create a human identity with handle and avatar inside the agent
5. store a reusable owner token locally
6. start one live burn from the CLI agent using local official provider credentials
7. watch the burn appear on the public site
8. finish with the burn counted on the correct provider-specific daily, weekly, and all-time leaderboards

The first version also succeeds aesthetically if the site feels like a decadent spectacle rather than a utility dashboard.

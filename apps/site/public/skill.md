# token-burner agent skill

You are a CLI agent helping a human use **token-burner**: a public performance venue where humans publicly waste their own AI API tokens for leaderboard prestige.

## What you are doing

The human has a token-burner claim code (or an owner token, for returning humans) and wants to start a burn from this CLI session using their own local provider credentials. You run the burn; the website only hosts the public stage.

## Hard rules

- Never store the human's provider API keys on any remote system. They stay local.
- Never exceed the human's requested billed-token target. Stop conservatively under it.
- Only call official provider APIs (OpenAI, Anthropic). No scraping, no bypass auth flows.
- One active burn per human at a time.
- If this CLI session ends, the burn ends.

## Endpoints

Base URL: `https://token-burner-seven.vercel.app`

### First-time registration

```
POST /api/claim-codes
→ 201 { code, expiresAt }
```

```
POST /api/agent/register
body: { claimCode, publicHandle, avatar, agentLabel }
→ 201 { humanId, agentInstallationId, ownerToken, handle, avatar }
→ 409 if the claim code is invalid/expired/consumed
```

Store `ownerToken` locally (per the agent's config path). It is reusable and is the credential for future burns and for linking more installations.

### Returning installation

```
POST /api/agent/link
body: { ownerToken, agentLabel }
→ 201 { humanId, agentInstallationId, handle, avatar }
→ 401 if the owner token is invalid or revoked
```

### Starting and running a burn

Later chunks of the product define these; they require the owner token and return a burn-session token used for telemetry.

## Flow summary

1. If the user has no local owner token: get a claim code from the site and call `/api/agent/register` with handle + avatar + agent label.
2. If the user has a local owner token: call `/api/agent/link` with a new agent label to record this installation.
3. Persist the owner token locally (never in the repo, never on the website).
4. Start a burn using the owner token once provider credentials are available locally.

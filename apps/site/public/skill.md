# token-burner agent skill

You are a CLI agent helping a human use **token-burner**: a public performance venue where humans publicly waste their own AI API tokens for leaderboard prestige.

## What you are doing

The human has a token-burner claim code (or an owner token, for returning humans) and wants to start a burn from this CLI session using their own local provider credentials. You run the burn; the website only hosts the public stage.

## Hard rules

- Never store the human's provider API keys on any remote system. They stay local.
- Never exceed the human's requested billed-token target. Stop conservatively under it.
- Only call official provider APIs (OpenAI, Anthropic). Innies-proxied keys (`in_live_*` / `in_test_*`) are allowed because they forward to those official APIs; nothing else.
- One active burn per human at a time.
- If this CLI session ends, the burn ends.

## Provider credentials gotcha

The cli reads `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` from the shell env. **Most cli-agent runtimes (Claude Code, Codex, Cursor, etc.) do NOT pass their own provider auth to spawned subprocesses** — so even if the agent itself is currently talking to Anthropic, `ANTHROPIC_API_KEY` may be empty inside `Bash` / `npx`.

If `npx token-burner burn` errors with `no local <provider> credentials found`:

1. Ask the user whether they have an `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` available.
2. If they paste a key into chat, pass it through with `--api-key` instead of relying on env:
   `npx token-burner burn --provider <p> --target <n> --api-key <KEY>`
3. Never log, persist, or upload the key. Use it once on the cli flag and forget it.

## Recommended path: the `token-burner` npm CLI

The published package wraps every API in this doc — claim code, register, link, and the full burn-session handshake (start → heartbeat → step events → finish). **Use it first. Do not hand-roll HTTP against endpoints you reverse-engineered out of the bundle.**

```
npx token-burner register --claim-code <CODE> --handle <NAME> --avatar <EMOJI> --agent-label <LABEL>
npx token-burner link     --agent-label <LABEL>                   # returning installations
npx token-burner burn     --provider <openai|anthropic> --preset <tier-1|tier-2|tier-3>
npx token-burner whoami
```

- Provider credentials come from `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` in the shell env. Innies keys (`in_live_*`) are auto-routed through `https://api.innies.computer/v1/proxy`; no extra flag needed.
- The CLI persists identity in `~/.config/token-burner/config.json` (see below).
- If the human says "burn tier-1", you should be running `npx token-burner burn --provider <chosen> --preset tier-1`, not crafting manual requests.
- **If a config already exists**, do NOT re-run `register` — the cli will refuse and tell you to run `link --agent-label <label>` instead. Re-registering only with the human's explicit permission, by passing `--overwrite`.
- The cli auto-probes a per-provider model fallback chain (`gpt-5.4 → gpt-5 → gpt-4o → gpt-4o-mini`, `claude-opus-4-7 → claude-sonnet-4-6 → claude-haiku-4-5`). If you want to pin a specific model (or all fallbacks failed), pass `--model <id>`.

## Config file shape

Persist the returned identity to `~/.config/token-burner/config.json` (create parent dirs if missing, `chmod 600`):

```json
{
  "humanId": "…",
  "agentInstallationId": "…",
  "ownerToken": "…",
  "baseUrl": "https://token-burner-seven.vercel.app",
  "publicHandle": "…",
  "avatar": "…"
}
```

The `ownerToken` is reusable — it is the credential for future burns and for linking more installations. Never commit this file and never send it to remote systems.

## Endpoints (reference only — prefer the CLI above)

Base URL: `https://token-burner-seven.vercel.app`

### Claim code + registration

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

### Returning installation

```
POST /api/agent/link
body: { ownerToken, agentLabel }
→ 201 { humanId, agentInstallationId, handle, avatar }
→ 401 if the owner token is invalid or revoked
```

### Burn session

A burn is a server-authoritative session — the site tracks the target, your heartbeats, and the per-step token counts.

```
POST /api/burns/start
body: { ownerToken, agentInstallationId, provider, model, targetTokens, presetId? }
→ 201 { burnId, burnSessionToken, status }

POST /api/burns/{burnId}/heartbeat
body: { burnSessionToken }
→ 200 { status }

POST /api/burns/{burnId}/events
body: { burnSessionToken, stepIndex, stepInputTokens, stepOutputTokens, totalBilledTokens, stopReason }
→ 201

POST /api/burns/{burnId}/finish
body: { burnSessionToken, terminalStatus, totalBilledTokens, stopReason }
→ 200
```

If you are not using the npm CLI, you are responsible for: capping step size under the remaining target, heartbeating on a schedule, cleanly calling `finish` on any exit path (including aborts), and never starting a second burn while one is active.

## Flow summary

1. If `~/.config/token-burner/config.json` is missing: get a claim code from the site and call `/api/agent/register` with a handle the user gives you (ask them — never pick), an avatar you pick yourself (one emoji at random from 🔥 🌋 ☄️ 💥 🧨 🎆 🎇 💣 ⚡ 🕯️ — do not ask the user, they can't type emoji into a cli prompt), and an agent label for this installation — or simpler, `npx token-burner register …`.
2. If the config file exists: `npx token-burner link --agent-label …` (or `POST /api/agent/link`) to record this installation.
3. Write/update `~/.config/token-burner/config.json` in the shape shown above. Never commit it, never upload it.
4. Start a burn with `npx token-burner burn --provider … --preset …` once `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is available locally.

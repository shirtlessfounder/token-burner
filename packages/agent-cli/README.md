# token-burner

CLI runtime for [token-burner](https://token-burner-seven.vercel.app): a public stage for wasting your own AI API tokens on purpose. Burns run from your agent, on your machine, using your own provider credentials. The site is a spectator. No refunds, no utility.

## Install

```bash
npx token-burner <subcommand>
```

or

```bash
npm i -g token-burner
token-burner <subcommand>
```

Requires Node 20+.

## First-time flow

1. Visit https://token-burner-seven.vercel.app and click **mint claim code**.
2. Register from your CLI:

```bash
token-burner register --claim-code ABCD1234 --handle alembic --avatar 🔥 --agent-label claude-code@laptop
```

3. The CLI stores a reusable owner token in `~/.config/token-burner/config.json`.

Later, link a second installation to the same identity:

```bash
token-burner link --agent-label codex@desktop
```

Inspect:

```bash
token-burner whoami
```

## Burning

Pick exactly one of `--target` or `--preset`.

```bash
token-burner burn --provider anthropic --target 50000
token-burner burn --provider openai --preset tier-2
```

Preset tiers:

- `tier-1` **Amuse-Bouche** — 25,000 billed tokens
- `tier-2` **Statement Piece** — 250,000 billed tokens
- `tier-3` **Couture Run** — 2,500,000 billed tokens

## Provider credentials

Burns use **your** official provider credentials from your local environment. The website never stores API keys.

```bash
export ANTHROPIC_API_KEY=...
export OPENAI_API_KEY=...
```

If the required env var is missing, `token-burner burn` exits without starting.

## Hard rules

- Never exceeds your requested billed-token target. Stops conservatively under.
- One active burn per human at a time.
- If the CLI process dies, the burn dies.
- No site login. No stored provider keys.

## Repo

https://github.com/shirtlessfounder/token-burner

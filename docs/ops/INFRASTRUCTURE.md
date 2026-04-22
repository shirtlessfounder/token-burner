# Token Burner Infrastructure

Canonical source of truth for the initial `token-burner` cloud footprint, local linkage, and required environment contract.

## Current topology

```text
Public web app
  Vercel team: dylan-slateceos-projects
  Project: token-burner
  Project ID: prj_sqXmugnqbPNHSkiCmwxN2e7KKh0B
  Local checkout linked from: /Users/dylanvu/token-burner/apps/site

Primary database
  Supabase org: shirtless
  Org ID: gfihggqinolziwxoyaah
  Project: token-burner
  Project ref: avvhkermwadxttzpplmi
  Region: us-east-1
  Postgres: 17

CLI package
  Target package: not published yet
  Execution model: runs on the user's machine via npx, not on shared infra
```

## Vercel

- Owner team: `dylan-slateceos-projects`
- Project name: `token-burner`
- Project ID: `prj_sqXmugnqbPNHSkiCmwxN2e7KKh0B`
- Root directory (server-side): `apps/site`
- Framework: `nextjs`
- Install command: `cd ../.. && npm install`
- Vercel link file lives at repo root `.vercel/project.json`
- Production URL: `https://token-burner-seven.vercel.app` (the plain `token-burner.vercel.app` subdomain is owned by another project)

Useful commands:

```bash
cd /Users/dylanvu/token-burner/apps/site
npx vercel project inspect token-burner --scope dylan-slateceos-projects
npx vercel link --yes --project token-burner --scope dylan-slateceos-projects
```

Notes:

- `.vercel/project.json` is local-only metadata and stays uncommitted.

## Supabase

- Org: `shirtless`
- Org ID: `gfihggqinolziwxoyaah`
- Project name: `token-burner`
- Project ref: `avvhkermwadxttzpplmi`
- Dashboard: `https://supabase.com/dashboard/project/avvhkermwadxttzpplmi`
- Region: `us-east-1` (`East US (North Virginia)`)
- Postgres: `17`

Local CLI linkage is stored in `supabase/.temp/linked-project.json` and should not be committed.

Useful commands:

```bash
cd /Users/dylanvu/token-burner
npx supabase projects list
npx supabase link --project-ref avvhkermwadxttzpplmi --password "$(security find-generic-password -a dylanvu -s 'token-burner Supabase DB password' -w)"
```

## Database password handling

The initial Supabase DB password is stored in the local macOS keychain under:

- service: `token-burner Supabase DB password`
- account: `dylanvu`

Retrieve it locally with:

```bash
security find-generic-password -a dylanvu -s "token-burner Supabase DB password" -w
```

## Environment contract

Required app env vars:

- `DATABASE_URL`
  Runtime connection string. Use the Supabase transaction pooler on port `6543` with `sslmode=no-verify`.
- `DATABASE_URL_MIGRATIONS`
  Migration / admin connection string. Use the Supabase session pooler on port `5432` with `sslmode=require`.
- `NEXT_PUBLIC_APP_URL`
  Public site origin.
- `TOKEN_BURNER_BASE_URL`
  Canonical server base URL for the CLI and public assets.
- `OWNER_TOKEN_HASH_SECRET`
  32-byte random secret used for hashing reusable owner tokens before persistence.

The checked-in template lives at `/Users/dylanvu/token-burner/.env.example`.

## Connection string shapes

Runtime pooler:

```text
postgresql://postgres.avvhkermwadxttzpplmi:<PASSWORD>@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=no-verify
```

Migration pooler:

```text
postgresql://postgres.avvhkermwadxttzpplmi:<PASSWORD>@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
```

## Smoke checks

Verify the linked infra from the repo root:

```bash
cd /Users/dylanvu/token-burner
npx supabase projects list
cd apps/site
npx vercel project inspect token-burner --scope dylan-slateceos-projects
```

## Deliberate non-goals for v1 infra

- No exe.dev service. The public site is on Vercel and burns execute from the user's local CLI agent.
- No shared worker fleet. If the agent session dies, the burn dies.
- No provider credential storage on the website.

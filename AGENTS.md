# AGENTS.md

Start with the product docs in this repo, not external summaries.

Required read order:

1. `docs/product/design.md`
2. `docs/product/delivery-plan.md`
3. `docs/ops/INFRASTRUCTURE.md`

Repo rules:

- Keep the agent-first product shape intact.
- Do not add human site login in v1.
- Do not store provider API keys on the website.
- Burns start from the CLI package, not from the browser.
- Keep provider leaderboards split by provider.
- Treat `docs/product/design.md` as product truth and `docs/product/delivery-plan.md` as execution truth.

Execution notes:

- Prefer small commits with conventional commit messages.
- Verify commands before claiming progress.
- Preserve the repo's current npm workspace structure.
- Do not commit `.vercel/` or `supabase/.temp/`.

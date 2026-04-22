import {
  getLiveBurnFeed,
  getProviderAllTimeLeaderboard,
  getProviderDailyLeaderboard,
  getProviderWeeklyLeaderboard,
} from "../lib/db/queries";
import { ClaimCodePanel } from "./_components/claim-code-panel";
import { LeaderboardSection } from "./_components/leaderboard-section";
import { LiveBurnFeed } from "./_components/live-burn-feed";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://token-burner-seven.vercel.app";

  const [daily, weekly, allTime, liveFeed] = await Promise.all([
    getProviderDailyLeaderboard({ limit: 10 }),
    getProviderWeeklyLeaderboard({ limit: 10 }),
    getProviderAllTimeLeaderboard({ limit: 10 }),
    getLiveBurnFeed({ limit: 10 }),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-16">
      <header className="flex flex-col gap-3 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">
          a public venue for wasting tokens
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          token-burner
        </h1>
        <p className="mx-auto max-w-xl text-base text-zinc-500">
          claim an identity here. burn from your CLI. climb the
          provider-split leaderboards. the site never touches your provider
          keys.
        </p>
      </header>

      <LeaderboardSection title="all time" leaderboard={allTime} />
      <LeaderboardSection title="this week" leaderboard={weekly} />
      <LeaderboardSection title="today" leaderboard={daily} />

      <LiveBurnFeed entries={liveFeed} />

      <section className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">
          onboard a new burner
        </h2>
        <div className="flex flex-col gap-6">
          <div>
            <p className="mb-2 text-xs uppercase tracking-widest text-zinc-500">
              step 1 — mint a one-time claim code
            </p>
            <ClaimCodePanel />
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-widest text-zinc-500">
              step 2 — paste into your CLI agent
            </p>
            <pre className="whitespace-pre-wrap break-words rounded-lg bg-zinc-100 p-4 text-sm text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
{`read ${appUrl}/skill.md then register me on token-burner with the claim code i will paste next. pick a short handle and a single-emoji avatar. store the owner token locally.`}
            </pre>
            <p className="mt-3 text-xs text-zinc-500">
              the agent fetches the bootstrap doc, calls the register
              endpoint, and saves the reusable owner token to your local
              machine. provider keys stay local.
            </p>
          </div>
        </div>
      </section>

      <footer className="pt-6 text-center text-xs text-zinc-500">
        no site login. no stored API keys. burns stop when your CLI stops.
      </footer>
    </main>
  );
}

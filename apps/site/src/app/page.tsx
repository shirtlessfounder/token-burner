import {
  getLiveBurnFeed,
  getProviderAllTimeLeaderboard,
  getProviderDailyLeaderboard,
  getProviderWeeklyLeaderboard,
} from "../lib/db/queries";
import { BurnsRealtimeRefresher } from "./_components/burns-realtime-refresher";
import { ClaimCodePanel } from "./_components/claim-code-panel";
import { CliPromptPanel } from "./_components/cli-prompt-panel";
import { LeaderboardSection } from "./_components/leaderboard-section";
import { LiveBurnFeed } from "./_components/live-burn-feed";
import { MarqueeBanner } from "./_components/marquee-banner";

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
    <>
      <BurnsRealtimeRefresher />

      <header className="border-b-2 border-ivory">
        <div className="mx-auto flex w-full max-w-6xl items-end justify-between gap-4 px-6 pt-10 pb-4">
          <span className="mono text-[0.65rem] uppercase tracking-[0.3em] text-bone">
            est. 2026
          </span>
          <span className="mono text-[0.65rem] uppercase tracking-[0.3em] text-bone">
            season of ash · vol. i
          </span>
        </div>
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-6 py-6 text-center">
          <p className="chip chip-ember">a public venue for wasting tokens</p>
          <h1 className="display text-6xl font-black uppercase leading-[0.85] tracking-tight sm:text-8xl md:text-[9rem]">
            TOKEN<span className="text-ember">—</span>BURNER
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-bone sm:text-base">
            claim an identity here. burn from your CLI. climb the
            provider-split leaderboards. the site never touches your
            provider keys. no utility. no refunds.
          </p>
        </div>
      </header>

      <MarqueeBanner />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-16">
        <section className="border-2 border-ivory">
          <div className="flex items-end justify-between gap-4 border-b-2 border-ivory bg-ember px-6 py-3 text-ink">
            <h2 className="display text-2xl font-black uppercase tracking-tight sm:text-3xl">
              onboard a new burner
            </h2>
            <span className="mono text-[0.65rem] uppercase tracking-[0.3em]">
              two steps
            </span>
          </div>
          <div className="grid grid-cols-1 divide-y-2 divide-ivory md:grid-cols-2 md:divide-y-0 md:divide-x-2">
            <div className="flex flex-col gap-4 p-6">
              <p className="mono text-[0.65rem] uppercase tracking-[0.3em] text-bone">
                step 01 — mint a one-time code
              </p>
              <ClaimCodePanel />
            </div>
            <div className="flex flex-col gap-3 p-6">
              <p className="mono text-[0.65rem] uppercase tracking-[0.3em] text-bone">
                step 02 — paste into your cli agent
              </p>
              <CliPromptPanel
                prompt={`read ${appUrl}/skill.md then register me on
token-burner with the claim code i will paste
next. pick a short handle and a single-emoji
avatar. store the owner token locally.`}
              />
              <p className="mono text-[0.6rem] uppercase tracking-[0.25em] text-bone">
                agent fetches the bootstrap doc, hits /api/agent/register,
                saves the reusable owner token to your machine. provider
                keys stay local.
              </p>
            </div>
          </div>
        </section>

        <LiveBurnFeed entries={liveFeed} />

        <LeaderboardSection title="today" leaderboard={daily} />
        <LeaderboardSection title="this week" leaderboard={weekly} />
        <LeaderboardSection title="all time" leaderboard={allTime} />

        <footer className="flex flex-col items-center gap-1 border-t-2 border-ivory pt-8 text-center">
          <p className="mono text-[0.6rem] uppercase tracking-[0.3em] text-bone">
            no site login · no stored api keys · burns stop when your cli stops
          </p>
          <p className="mono text-[0.5rem] uppercase tracking-[0.3em] text-smoke">
            token-burner · mmxxvi
          </p>
        </footer>
      </main>
    </>
  );
}

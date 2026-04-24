import {
  getLiveBurnFeed,
  getProviderAllTimeLeaderboard,
  getProviderDailyLeaderboard,
  getProviderWeeklyLeaderboard,
} from "../lib/db/queries";
import { BurnsRealtimeRefresher } from "./_components/burns-realtime-refresher";
import { LeaderboardSection } from "./_components/leaderboard-section";
import { LiveBurnFeed } from "./_components/live-burn-feed";
import { MarqueeBanner } from "./_components/marquee-banner";
import { OnboardPanel } from "./_components/onboard-panel";

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
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://github.com/shirtlessfounder/token-burner"
              target="_blank"
              rel="noopener noreferrer"
              className="chip transition-colors hover:border-ember hover:text-ember"
            >
              github
            </a>
            <a
              href="https://shirtless.life"
              target="_blank"
              rel="noopener noreferrer"
              className="chip transition-colors hover:border-ember hover:text-ember"
            >
              a shirtless project
            </a>
            <a
              href="https://t.me/shirtlessfounder"
              target="_blank"
              rel="noopener noreferrer"
              className="chip chip-ember transition-opacity hover:opacity-80"
            >
              having trouble burning? lmk
            </a>
          </div>
        </div>
      </header>

      <MarqueeBanner />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-16">
        <OnboardPanel appUrl={appUrl} />

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

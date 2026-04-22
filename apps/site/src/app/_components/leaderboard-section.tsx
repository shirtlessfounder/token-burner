import Link from "next/link";

import { providerValues, type ProviderId } from "@token-burner/shared";

import type { ProviderSplitLeaderboard } from "../../lib/db/queries";

export type LeaderboardSectionProps = {
  title: string;
  leaderboard: ProviderSplitLeaderboard;
};

const providerLabels: Record<ProviderId, string> = {
  openai: "OPENAI",
  anthropic: "ANTHROPIC",
};

const formatTokens = (n: number): string =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });

const formatRank = (rank: number): string =>
  rank.toString().padStart(2, "0");

export function LeaderboardSection({ title, leaderboard }: LeaderboardSectionProps) {
  return (
    <section className="w-full">
      <div className="mb-5 flex items-end justify-between gap-4 border-b-2 border-ivory pb-2">
        <h2 className="display text-3xl font-black uppercase tracking-tight sm:text-4xl">
          {title}
        </h2>
        <span className="chip">leaderboard</span>
      </div>
      <div className="grid grid-cols-1 gap-0 border-2 border-ivory md:grid-cols-2">
        {providerValues.map((provider, providerIndex) => {
          const entries = leaderboard[provider];
          return (
            <div
              key={provider}
              className={`${
                providerIndex === 0 ? "md:border-r-2 md:border-ivory" : ""
              } border-b-2 border-ivory last:border-b-0 md:border-b-0`}
            >
              <div className="flex items-baseline justify-between border-b-2 border-ivory bg-char px-5 py-3">
                <h3 className="display text-xl font-black tracking-tight">
                  {providerLabels[provider]}
                </h3>
                <span className="mono text-[0.65rem] uppercase tracking-widest text-bone">
                  billed tokens
                </span>
              </div>
              {entries.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm uppercase tracking-widest text-bone">
                  — nothing burned —
                </p>
              ) : (
                <ol>
                  {entries.map((entry) => (
                    <li
                      key={entry.humanId}
                      className="flex items-center justify-between gap-4 border-b border-smoke px-5 py-3 last:border-b-0 hover:bg-char"
                    >
                      <span className="flex min-w-0 items-baseline gap-4">
                        <span className="mono w-8 text-right text-xs text-bone">
                          {formatRank(entry.rank)}
                        </span>
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 text-lg">
                            {entry.avatarUrl}
                          </span>
                          <Link
                            href={`/u/${entry.handle}`}
                            className="display truncate text-base font-semibold tracking-tight hover:text-ember"
                          >
                            {entry.handle}
                          </Link>
                        </span>
                      </span>
                      <span className="mono shrink-0 text-base tabular-nums">
                        {formatTokens(entry.totalBilledTokens)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

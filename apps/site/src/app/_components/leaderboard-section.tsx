import Link from "next/link";

import { providerValues, type ProviderId } from "@token-burner/shared";

import type { ProviderSplitLeaderboard } from "../../lib/db/queries";

export type LeaderboardSectionProps = {
  title: string;
  leaderboard: ProviderSplitLeaderboard;
};

const providerLabels: Record<ProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
};

const formatTokens = (n: number): string =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });

export function LeaderboardSection({ title, leaderboard }: LeaderboardSectionProps) {
  return (
    <section className="w-full">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {providerValues.map((provider) => {
          const entries = leaderboard[provider];
          return (
            <div
              key={provider}
              className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800"
            >
              <div className="mb-3 flex items-baseline justify-between">
                <h3 className="text-lg font-semibold">
                  {providerLabels[provider]}
                </h3>
                <span className="text-xs uppercase tracking-widest text-zinc-500">
                  billed tokens
                </span>
              </div>
              {entries.length === 0 ? (
                <p className="text-sm text-zinc-500">nothing burned yet.</p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {entries.map((entry) => (
                    <li
                      key={entry.humanId}
                      className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-2 last:border-none last:pb-0 dark:border-zinc-900"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="w-6 text-right font-mono text-xs text-zinc-500">
                          {entry.rank}
                        </span>
                        <span className="truncate">
                          <Link
                            href={`/u/${entry.handle}`}
                            className="font-medium hover:underline"
                          >
                            {entry.avatarUrl} {entry.handle}
                          </Link>
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-sm">
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

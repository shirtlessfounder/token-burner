import Link from "next/link";

import type { ProviderId } from "@token-burner/shared";

import type { LiveBurnFeedEntry } from "../../lib/db/queries";

export type LiveBurnFeedProps = {
  entries: LiveBurnFeedEntry[];
};

const providerLabels: Record<ProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
};

const formatTokens = (n: number): string =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });

const percent = (consumed: number, target: number): number => {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((consumed / target) * 100));
};

export function LiveBurnFeed({ entries }: LiveBurnFeedProps) {
  return (
    <section className="w-full">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">
          currently burning
        </h2>
        <span className="text-xs text-zinc-500">
          {entries.length} active
        </span>
      </div>
      {entries.length === 0 ? (
        <p className="rounded-2xl border border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800">
          no active burns. start one from the CLI.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => {
            const pct = percent(
              entry.billedTokensConsumed,
              entry.requestedBilledTokenTarget,
            );
            return (
              <li
                key={entry.burnId}
                className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {entry.avatarUrl}{" "}
                      <Link
                        href={`/u/${entry.handle}`}
                        className="hover:underline"
                      >
                        {entry.handle}
                      </Link>
                      {" — "}
                      <Link
                        href={`/burns/${entry.burnId}`}
                        className="text-xs text-zinc-500 hover:underline"
                      >
                        watch burn
                      </Link>
                    </p>
                    <p className="text-xs text-zinc-500">
                      {providerLabels[entry.provider]} · {entry.model}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg">
                      {formatTokens(entry.billedTokensConsumed)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      / {formatTokens(entry.requestedBilledTokenTarget)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                  <div
                    className="h-full bg-zinc-900 dark:bg-zinc-100"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

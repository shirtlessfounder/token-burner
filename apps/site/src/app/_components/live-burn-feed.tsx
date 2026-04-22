import Link from "next/link";

import type { ProviderId } from "@token-burner/shared";

import type { LiveBurnFeedEntry } from "../../lib/db/queries";

export type LiveBurnFeedProps = {
  entries: LiveBurnFeedEntry[];
};

const providerLabels: Record<ProviderId, string> = {
  openai: "OPENAI",
  anthropic: "ANTHROPIC",
};

const formatTokens = (n: number): string =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });

const percent = (consumed: number, target: number): number => {
  if (target <= 0) return 0;
  return Math.min(100, (consumed / target) * 100);
};

export function LiveBurnFeed({ entries }: LiveBurnFeedProps) {
  return (
    <section className="w-full">
      <div className="mb-5 flex items-end justify-between gap-4 border-b-2 border-ivory pb-2">
        <h2 className="display flex items-center gap-3 text-3xl font-black uppercase tracking-tight sm:text-4xl">
          <span className="ember-dot" />
          burning now
        </h2>
        <span className="chip chip-ember">{entries.length} active</span>
      </div>

      {entries.length === 0 ? (
        <p className="border-2 border-ivory bg-char px-6 py-12 text-center text-sm uppercase tracking-[0.3em] text-bone">
          the pyre is cold. start one from your CLI.
        </p>
      ) : (
        <ul className="flex flex-col gap-0 border-2 border-ivory">
          {entries.map((entry) => {
            const pct = percent(
              entry.billedTokensConsumed,
              entry.requestedBilledTokenTarget,
            );
            return (
              <li
                key={entry.burnId}
                className="border-b-2 border-ivory p-5 last:border-b-0 hover:bg-char"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <div className="min-w-0">
                    <p className="display text-xl font-black tracking-tight">
                      <span className="mr-2 text-2xl">{entry.avatarUrl}</span>
                      <Link
                        href={`/u/${entry.handle}`}
                        className="hover:text-ember"
                      >
                        {entry.handle}
                      </Link>
                    </p>
                    <p className="mono mt-1 text-[0.7rem] uppercase tracking-widest text-bone">
                      {providerLabels[entry.provider]} · {entry.model}
                      {" · "}
                      <Link
                        href={`/burns/${entry.burnId}`}
                        className="underline hover:text-ember"
                      >
                        watch
                      </Link>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="mono text-2xl tabular-nums">
                      {formatTokens(entry.billedTokensConsumed)}
                    </p>
                    <p className="mono text-[0.7rem] uppercase tracking-widest text-bone">
                      / {formatTokens(entry.requestedBilledTokenTarget)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 h-1 w-full overflow-hidden bg-char">
                  <div
                    className="h-full bg-ember transition-[width] duration-700 ease-out"
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

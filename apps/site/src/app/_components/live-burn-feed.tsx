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
          {entries.map((entry) => (
            <li
              key={entry.burnId}
              className="border-b-2 border-ivory p-5 last:border-b-0 hover:bg-char"
            >
              <div className="flex items-center justify-between gap-4">
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
                <div className="flex items-center gap-3">
                  <span className="burning-flame" aria-hidden>
                    🔥
                  </span>
                  <p className="mono text-2xl tabular-nums">
                    {formatTokens(entry.requestedBilledTokenTarget)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

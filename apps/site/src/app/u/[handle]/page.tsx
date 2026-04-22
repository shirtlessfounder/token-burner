import Link from "next/link";
import { notFound } from "next/navigation";

import { providerValues, type ProviderId } from "@token-burner/shared";

import { getPublicProfileByHandle } from "../../../lib/db/queries";

export const dynamic = "force-dynamic";

const providerLabels: Record<ProviderId, string> = {
  openai: "OPENAI",
  anthropic: "ANTHROPIC",
};

const formatTokens = (n: number): string =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });

const formatDateTime = (date: Date): string =>
  date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const profile = await getPublicProfileByHandle(handle);

  if (!profile) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-6 py-16">
      <div className="flex items-center justify-between gap-4 border-b-2 border-ivory pb-3">
        <Link
          href="/"
          className="mono text-[0.65rem] uppercase tracking-[0.3em] text-bone hover:text-ivory"
        >
          ← leaderboards
        </Link>
        <span className="chip">profile</span>
      </div>

      <header className="flex flex-col items-center gap-2 text-center">
        <p className="text-7xl">{profile.avatarUrl}</p>
        <h1 className="display text-5xl font-black uppercase leading-none tracking-tight sm:text-7xl">
          {profile.handle}
        </h1>
      </header>

      <section>
        <p className="mono mb-3 text-[0.65rem] uppercase tracking-[0.3em] text-bone">
          totals by provider
        </p>
        <div className="grid grid-cols-1 gap-0 border-2 border-ivory sm:grid-cols-2">
          {providerValues.map((provider, providerIndex) => (
            <div
              key={provider}
              className={`p-6 ${
                providerIndex === 0
                  ? "border-b-2 border-ivory sm:border-b-0 sm:border-r-2"
                  : ""
              }`}
            >
              <p className="mono text-[0.65rem] uppercase tracking-[0.3em] text-bone">
                {providerLabels[provider]}
              </p>
              <p className="display mt-2 text-5xl font-black tabular-nums tracking-tight sm:text-6xl">
                {formatTokens(profile.providerTotals[provider])}
              </p>
              <p className="mono mt-1 text-[0.6rem] uppercase tracking-[0.25em] text-bone">
                billed tokens
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="mono mb-3 text-[0.65rem] uppercase tracking-[0.3em] text-bone">
          recent burns
        </p>
        {profile.recentBurns.length === 0 ? (
          <p className="border-2 border-ivory bg-char px-6 py-12 text-center text-sm uppercase tracking-[0.3em] text-bone">
            — nothing burned yet —
          </p>
        ) : (
          <ul className="flex flex-col gap-0 border-2 border-ivory">
            {profile.recentBurns.map((burn) => (
              <li
                key={burn.burnId}
                className="border-b-2 border-ivory p-5 last:border-b-0 hover:bg-char"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      href={`/burns/${burn.burnId}`}
                      className="display text-base font-semibold tracking-tight hover:text-ember"
                    >
                      {providerLabels[burn.provider]} · {burn.model}
                    </Link>
                    <p className="mono mt-1 text-[0.65rem] uppercase tracking-widest text-bone">
                      {formatDateTime(burn.createdAt)} · {burn.status}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="mono text-lg tabular-nums">
                      {formatTokens(burn.billedTokensConsumed)}
                    </p>
                    <p className="mono text-[0.6rem] uppercase tracking-[0.25em] text-bone">
                      / {formatTokens(burn.requestedBilledTokenTarget)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

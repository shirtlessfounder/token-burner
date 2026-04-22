import Link from "next/link";
import { notFound } from "next/navigation";

import { providerValues, type ProviderId } from "@token-burner/shared";

import { getPublicProfileByHandle } from "../../../lib/db/queries";

export const dynamic = "force-dynamic";

const providerLabels: Record<ProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
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
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col items-center gap-3 text-center">
        <p className="text-5xl">{profile.avatarUrl}</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {profile.handle}
        </h1>
        <Link
          href="/"
          className="text-xs uppercase tracking-widest text-zinc-500 hover:underline"
        >
          ← back to leaderboards
        </Link>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">
          totals by provider
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {providerValues.map((provider) => (
            <div
              key={provider}
              className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800"
            >
              <p className="text-xs uppercase tracking-widest text-zinc-500">
                {providerLabels[provider]}
              </p>
              <p className="mt-2 font-mono text-3xl">
                {formatTokens(profile.providerTotals[provider])}
              </p>
              <p className="text-xs text-zinc-500">billed tokens</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">
          recent burns
        </h2>
        {profile.recentBurns.length === 0 ? (
          <p className="rounded-2xl border border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800">
            no burns yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {profile.recentBurns.map((burn) => (
              <li
                key={burn.burnId}
                className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <Link
                      href={`/burns/${burn.burnId}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {providerLabels[burn.provider]} · {burn.model}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {formatDateTime(burn.createdAt)} · {burn.status}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm">
                      {formatTokens(burn.billedTokensConsumed)}
                    </p>
                    <p className="text-xs text-zinc-500">
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

import Link from "next/link";
import { notFound } from "next/navigation";

import type { ProviderId } from "@token-burner/shared";

import { getPublicBurnById } from "../../../lib/db/queries";

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
    second: "2-digit",
  });

const percent = (consumed: number, target: number): number => {
  if (target <= 0) return 0;
  return Math.min(100, (consumed / target) * 100);
};

export default async function BurnPage({
  params,
}: {
  params: Promise<{ burnId: string }>;
}) {
  const { burnId } = await params;
  const burn = await getPublicBurnById(burnId);

  if (!burn) {
    notFound();
  }

  const pct = percent(burn.billedTokensConsumed, burn.requestedBilledTokenTarget);
  const isActive =
    burn.status === "queued" ||
    burn.status === "running" ||
    burn.status === "stopping";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col items-center gap-3 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">
          {isActive ? "live burn" : `burn ${burn.status}`}
        </p>
        <p className="text-5xl">{burn.avatarUrl}</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          <Link href={`/u/${burn.handle}`} className="hover:underline">
            {burn.handle}
          </Link>
        </h1>
        <p className="text-sm text-zinc-500">
          {providerLabels[burn.provider]} · {burn.model}
        </p>
      </header>

      <section className="flex flex-col items-center gap-4 text-center">
        <p className="font-mono text-6xl sm:text-7xl">
          {formatTokens(burn.billedTokensConsumed)}
        </p>
        <p className="text-sm text-zinc-500">
          of {formatTokens(burn.requestedBilledTokenTarget)} billed tokens (
          {pct.toFixed(1)}%)
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
          <div
            className="h-full bg-zinc-900 dark:bg-zinc-100"
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 p-5 text-sm dark:border-zinc-800">
        <dl className="grid grid-cols-2 gap-y-2">
          <dt className="text-zinc-500">status</dt>
          <dd className="font-mono">{burn.status}</dd>
          <dt className="text-zinc-500">created</dt>
          <dd className="font-mono">{formatDateTime(burn.createdAt)}</dd>
          {burn.startedAt ? (
            <>
              <dt className="text-zinc-500">started</dt>
              <dd className="font-mono">{formatDateTime(burn.startedAt)}</dd>
            </>
          ) : null}
          {burn.finishedAt ? (
            <>
              <dt className="text-zinc-500">finished</dt>
              <dd className="font-mono">{formatDateTime(burn.finishedAt)}</dd>
            </>
          ) : null}
          <dt className="text-zinc-500">burn id</dt>
          <dd className="truncate font-mono text-xs">{burn.burnId}</dd>
        </dl>
      </section>

      <footer className="text-center">
        <Link
          href="/"
          className="text-xs uppercase tracking-widest text-zinc-500 hover:underline"
        >
          ← back to leaderboards
        </Link>
      </footer>
    </main>
  );
}

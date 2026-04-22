import Link from "next/link";
import { notFound } from "next/navigation";

import type { ProviderId } from "@token-burner/shared";

import { getPublicBurnById } from "../../../lib/db/queries";
import { BurnLiveCounter } from "../../_components/burn-live-counter";

export const dynamic = "force-dynamic";

const providerLabels: Record<ProviderId, string> = {
  openai: "OPENAI",
  anthropic: "ANTHROPIC",
};

const formatDateTime = (date: Date): string =>
  date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

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

  const isActive =
    burn.status === "queued" ||
    burn.status === "running" ||
    burn.status === "stopping";

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-6 py-16">
      <div className="flex items-center justify-between gap-4 border-b-2 border-ivory pb-3">
        <Link
          href="/"
          className="mono text-[0.65rem] uppercase tracking-[0.3em] text-bone hover:text-ivory"
        >
          ← leaderboards
        </Link>
        <span className={`chip ${isActive ? "chip-ember" : ""}`}>
          {isActive ? "live burn" : `burn ${burn.status}`}
        </span>
      </div>

      <header className="flex flex-col items-center gap-3 text-center">
        <p className="text-6xl">{burn.avatarUrl}</p>
        <h1 className="display text-4xl font-black uppercase leading-none tracking-tight sm:text-6xl">
          <Link href={`/u/${burn.handle}`} className="hover:text-ember">
            {burn.handle}
          </Link>
        </h1>
        <p className="mono text-[0.7rem] uppercase tracking-[0.3em] text-bone">
          {providerLabels[burn.provider]} · {burn.model}
        </p>
      </header>

      <BurnLiveCounter
        burnId={burn.burnId}
        initialBilledTokens={burn.billedTokensConsumed}
        initialStatus={burn.status}
        requestedBilledTokenTarget={burn.requestedBilledTokenTarget}
      />

      <section className="border-2 border-ivory">
        <div className="border-b-2 border-ivory bg-char px-5 py-3">
          <p className="mono text-[0.65rem] uppercase tracking-[0.3em] text-bone">
            telemetry
          </p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 px-5 py-4 text-sm">
          <dt className="mono text-[0.7rem] uppercase tracking-widest text-bone">
            status
          </dt>
          <dd className="mono">{burn.status}</dd>
          <dt className="mono text-[0.7rem] uppercase tracking-widest text-bone">
            created
          </dt>
          <dd className="mono">{formatDateTime(burn.createdAt)}</dd>
          {burn.startedAt ? (
            <>
              <dt className="mono text-[0.7rem] uppercase tracking-widest text-bone">
                started
              </dt>
              <dd className="mono">{formatDateTime(burn.startedAt)}</dd>
            </>
          ) : null}
          {burn.finishedAt ? (
            <>
              <dt className="mono text-[0.7rem] uppercase tracking-widest text-bone">
                finished
              </dt>
              <dd className="mono">{formatDateTime(burn.finishedAt)}</dd>
            </>
          ) : null}
          <dt className="mono text-[0.7rem] uppercase tracking-widest text-bone">
            burn id
          </dt>
          <dd className="mono truncate text-xs">{burn.burnId}</dd>
        </dl>
      </section>
    </main>
  );
}

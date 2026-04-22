"use client";

import { useEffect, useState } from "react";

import type { BurnStatus } from "@token-burner/shared";

import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

type BurnRow = {
  billed_tokens_consumed: number;
  status: BurnStatus;
};

const activeStatuses = new Set<BurnStatus>(["queued", "running", "stopping"]);

export type BurnLiveCounterProps = {
  burnId: string;
  initialBilledTokens: number;
  initialStatus: BurnStatus;
  requestedBilledTokenTarget: number;
};

const formatTokens = (n: number): string =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });

const percent = (consumed: number, target: number): number => {
  if (target <= 0) return 0;
  return Math.min(100, (consumed / target) * 100);
};

export function BurnLiveCounter({
  burnId,
  initialBilledTokens,
  initialStatus,
  requestedBilledTokenTarget,
}: BurnLiveCounterProps) {
  const [billedTokens, setBilledTokens] = useState(initialBilledTokens);
  const [status, setStatus] = useState<BurnStatus>(initialStatus);

  useEffect(() => {
    if (!activeStatuses.has(status)) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`public:burns:${burnId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "burns",
          filter: `id=eq.${burnId}`,
        },
        (payload) => {
          const row = payload.new as BurnRow;
          setBilledTokens(row.billed_tokens_consumed);
          setStatus(row.status);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [burnId, status]);

  const pct = percent(billedTokens, requestedBilledTokenTarget);
  const isActive = activeStatuses.has(status);

  return (
    <section className="flex flex-col items-center gap-4 text-center">
      <p className="font-mono text-6xl sm:text-7xl">
        {formatTokens(billedTokens)}
      </p>
      <p className="text-sm text-zinc-500">
        of {formatTokens(requestedBilledTokenTarget)} billed tokens (
        {pct.toFixed(1)}%) · <span className="font-mono">{status}</span>
        {isActive ? " · live" : ""}
      </p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
        <div
          className="h-full bg-zinc-900 transition-[width] duration-500 ease-out dark:bg-zinc-100"
          style={{ width: `${pct}%` }}
        />
      </div>
    </section>
  );
}

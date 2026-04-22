"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import type { BurnStatus } from "@token-burner/shared";

import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import { AnimatedCounter } from "./animated-counter";

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
  const [flashKey, setFlashKey] = useState(0);

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
          setFlashKey((k) => k + 1);
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
    <section className="flex flex-col items-center gap-6 text-center">
      <div className="relative">
        <AnimatePresence>
          <motion.span
            key={flashKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="pointer-events-none absolute inset-0 -z-10 blur-3xl"
            style={{
              background:
                "radial-gradient(circle, var(--color-ember), transparent 70%)",
            }}
            aria-hidden="true"
          />
        </AnimatePresence>
        <AnimatedCounter
          value={billedTokens}
          className="display block text-7xl font-black leading-none tracking-tight sm:text-9xl"
        />
      </div>

      <p className="mono text-[0.7rem] uppercase tracking-[0.3em] text-bone">
        of {formatTokens(requestedBilledTokenTarget)} billed tokens ·{" "}
        {pct.toFixed(1)}% · <span className="text-ivory">{status}</span>
        {isActive ? <span className="ml-2 ember-dot" /> : null}
      </p>
      <div className="h-2 w-full overflow-hidden border-2 border-ivory bg-char">
        <motion.div
          className="h-full bg-ember"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </section>
  );
}

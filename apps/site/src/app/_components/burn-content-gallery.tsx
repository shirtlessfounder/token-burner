"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import type { BurnContentEvent } from "../../lib/db/queries";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

type BurnEventRow = {
  id: string;
  burn_id: string;
  event_payload: Record<string, unknown> | null;
  verified_output_tokens: number | null;
  created_at: string;
};

const extractContent = (
  payload: Record<string, unknown> | null,
): string | null => {
  if (!payload) return null;
  const value = payload.content;
  return typeof value === "string" && value.length > 0 ? value : null;
};

const extractStepIndex = (
  payload: Record<string, unknown> | null,
): number | null => {
  if (!payload) return null;
  const value = payload.stepIndex;
  return typeof value === "number" ? value : null;
};

const rowToEvent = (row: BurnEventRow): BurnContentEvent | null => {
  const content = extractContent(row.event_payload);
  if (content === null) return null;
  return {
    eventId: row.id,
    stepIndex: extractStepIndex(row.event_payload),
    content,
    verifiedOutputTokens: row.verified_output_tokens,
    createdAt: new Date(row.created_at),
  };
};

export type BurnContentGalleryProps = {
  burnId: string;
  initialEvents: BurnContentEvent[];
  isActive: boolean;
};

export function BurnContentGallery({
  burnId,
  initialEvents,
  isActive,
}: BurnContentGalleryProps) {
  const [events, setEvents] = useState<BurnContentEvent[]>(initialEvents);

  useEffect(() => {
    if (!isActive) return;

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`public:burn_events:${burnId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "burn_events",
          filter: `burn_id=eq.${burnId}`,
        },
        (payload) => {
          const row = payload.new as BurnEventRow;
          const event = rowToEvent(row);
          if (!event) return;
          setEvents((prior) => {
            if (prior.some((existing) => existing.eventId === event.eventId)) {
              return prior;
            }
            return [...prior, event];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [burnId, isActive]);

  const summary = useMemo(() => {
    const total = events.length;
    const verified = events.filter(
      (e) => typeof e.verifiedOutputTokens === "number",
    ).length;
    return { total, verified };
  }, [events]);

  if (events.length === 0) {
    return null;
  }

  const verifiedLabel = (() => {
    if (summary.verified === 0) return null;
    if (summary.verified === summary.total) {
      return `${summary.verified}/${summary.total} ✓ verified`;
    }
    return `${summary.verified}/${summary.total} partial ✓`;
  })();

  return (
    <section className="border-2 border-ivory">
      <div className="flex items-center justify-between border-b-2 border-ivory bg-char px-5 py-3">
        <p className="mono text-[0.65rem] uppercase tracking-[0.3em] text-bone">
          generated content ({summary.total} step
          {summary.total === 1 ? "" : "s"})
        </p>
        {verifiedLabel ? (
          <span
            className={`mono text-[0.6rem] uppercase tracking-[0.3em] ${
              summary.verified === summary.total
                ? "text-ember"
                : "text-bone"
            }`}
          >
            {verifiedLabel}
          </span>
        ) : null}
      </div>
      <ol className="flex flex-col">
        <AnimatePresence initial={false}>
          {events.map((event, index) => {
            const stepNumber = event.stepIndex ?? index + 1;
            return (
              <motion.li
                key={event.eventId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="border-b-2 border-ivory px-5 py-4 last:border-b-0"
              >
                <div className="mb-2 flex items-center justify-between gap-4">
                  <p className="mono text-[0.6rem] uppercase tracking-[0.3em] text-bone">
                    step {stepNumber}
                  </p>
                  {typeof event.verifiedOutputTokens === "number" ? (
                    <p className="mono text-[0.6rem] uppercase tracking-[0.3em] text-ember">
                      {event.verifiedOutputTokens.toLocaleString()} ✓
                    </p>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ivory">
                  {event.content}
                </p>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
    </section>
  );
}

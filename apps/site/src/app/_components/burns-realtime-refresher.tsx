"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

const debounceMs = 1_500;

export function BurnsRealtimeRefresher(): null {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let pendingRefresh: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (pendingRefresh) return;
      pendingRefresh = setTimeout(() => {
        pendingRefresh = null;
        router.refresh();
      }, debounceMs);
    };

    const channel = supabase
      .channel("public:burns")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "burns" },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (pendingRefresh) {
        clearTimeout(pendingRefresh);
      }
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}

"use client";

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export const getSupabaseBrowserClient = (): SupabaseClient => {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set for the browser supabase client.",
    );
  }

  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 5 } },
  });

  return browserClient;
};

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export class SupabaseConfigurationError extends Error {
  constructor() {
    super(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before using Supabase features.",
    );
    this.name = "SupabaseConfigurationError";
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabaseConfig = {
  isConfigured: Boolean(supabaseUrl && supabasePublishableKey),
};

let browserClient: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new SupabaseConfigurationError();
  }

  browserClient ??= createClient<Database>(
    supabaseUrl,
    supabasePublishableKey,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    },
  );

  return browserClient;
}
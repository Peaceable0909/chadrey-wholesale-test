import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// These are public browser values by design. Vercel environment variables remain preferred,
// but the fallback prevents a missing VITE_* setting from disabling the production login UI.
const PUBLIC_SUPABASE_URL = "https://pysfxmosoijbghfzfhge.supabase.co";
const PUBLIC_SUPABASE_KEY = "sb_publishable_1JpYRy4J3SguN2VIiqV4GQ_AI0LYEhV";

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || PUBLIC_SUPABASE_URL;
export const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || PUBLIC_SUPABASE_KEY;

export function isSupabaseConfigured(url = supabaseUrl, key = supabasePublishableKey) {
  return Boolean(url && key);
}

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to this environment.");
  }
  client ??= createClient(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

export const supabase = getSupabaseClient();

export function isGoogleSignInAvailable() {
  return isSupabaseConfigured();
}

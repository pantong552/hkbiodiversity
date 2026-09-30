import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const isClientConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isClientConfigured) {
  console.warn("Supabase credentials missing. App will fallback to static local data.");
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder-url-for-build-time.supabase.co",
  supabaseAnonKey || "placeholder-key-for-build-time"
);

export { isClientConfigured };

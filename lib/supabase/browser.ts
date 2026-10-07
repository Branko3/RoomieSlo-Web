import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseConfig } from "../config";

export function createSupabaseBrowserClient() {
  const config = getSupabaseConfig();
  if (!config.configured) {
    throw new Error(
      "Supabase is not configured. Add the public variables to .env.local.",
    );
  }

  return createBrowserClient(config.url, config.anonKey);
}

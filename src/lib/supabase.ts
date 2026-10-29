import { createClient } from "@supabase/supabase-js";
import { readAuthCallback } from "./auth-callback";
// Capture flow intent before the SDK consumes and clears the authentication hash.
// Never retain access tokens or the full callback URL here.
export const initialAuthCallback = readAuthCallback(window.location.href);
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key);
export const db = createClient(
  url || "https://placeholder.supabase.co",
  key || "unconfigured",
);

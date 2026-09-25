/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://xxxx.supabase.co */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon (public) key — safe to expose in the browser, RLS is the guard. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

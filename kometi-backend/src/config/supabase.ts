// src/config/supabase.ts
// Supabase Client initialization for the Kometi backend.
// Uses service_role key to bypass RLS — this is a server-side client only.

import { createClient } from "@supabase/supabase-js";
import env from "./env";

export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export default supabase;

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';

let _admin: SupabaseClient | null = null;

/** Server-side Supabase client using the service role key — bypasses RLS. Use only in trusted code. */
export function supabaseAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}

// api/supabase.js
import { createClient } from '@supabase/supabase-js';

export function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase URL/key');
  return createClient(url, key);
}

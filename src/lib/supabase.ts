import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const PESAN_ENV_KURANG =
  'NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY wajib diisi'

export function buatKlienSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(PESAN_ENV_KURANG)
  }

  return createClient(url, anonKey)
}

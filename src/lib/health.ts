import type { SupabaseClient } from '@supabase/supabase-js'

export const PESAN_BARIS_HILANG = 'baris app_health tidak ditemukan'

export type HasilKesehatan =
  | { sehat: true; disentuhPada: string }
  | { sehat: false; alasan: string }

export async function cekKesehatan(
  klien: SupabaseClient,
): Promise<HasilKesehatan> {
  const { data, error } = await klien
    .from('app_health')
    .select('disentuh_pada')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    return { sehat: false, alasan: error.message }
  }

  if (!data) {
    return { sehat: false, alasan: PESAN_BARIS_HILANG }
  }

  return {
    sehat: true,
    disentuhPada: (data as { disentuh_pada: string }).disentuh_pada,
  }
}

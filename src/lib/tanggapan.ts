import { PESAN_BARIS_HILANG } from '@/lib/health'
import { PESAN_ENV_KURANG } from '@/lib/supabase'

export const ALASAN_UMUM =
  'Something went wrong on our side. Please try again in a moment.'

/**
 * Pesan yang kita tulis sendiri, jadi isinya sudah dipastikan tidak memuat
 * bentuk skema database. Selain yang ada di daftar ini, pesan dianggap datang
 * dari Postgres dan tidak boleh keluar ke publik.
 */
const ALASAN_AMAN: ReadonlySet<string> = new Set([
  PESAN_ENV_KURANG,
  PESAN_BARIS_HILANG,
])

export function alasanPublik(
  alasan: string,
  opsi: { produksi: boolean },
): string {
  if (!opsi.produksi) {
    return alasan
  }

  return ALASAN_AMAN.has(alasan) ? alasan : ALASAN_UMUM
}

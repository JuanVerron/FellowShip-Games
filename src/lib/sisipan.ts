import { buatKlienSupabase } from '@/lib/supabase'

// Harus sama persis dengan batas di sisip_pertanyaan (migrasi 0008). Kalau
// keduanya bergeser, orang mengetik pertanyaan yang lolos di browser lalu
// ditolak database, dan galatnya muncul seperti tanpa sebab.
export const PANJANG_SISIPAN_MAKS = 200

/**
 * Merapikan masukan jadi satu baris.
 *
 * Baris baru ikut jadi spasi: kotak sisipan menerima satu pertanyaan, dan
 * teks yang membawa enter akan tampil terpotong aneh di segmen roda.
 */
export function rapikanPertanyaan(masukan: string): string {
  return masukan.replace(/\s+/g, ' ').trim()
}

export function pertanyaanValid(teks: string): boolean {
  const rapi = rapikanPertanyaan(teks)
  return rapi.length >= 1 && rapi.length <= PANJANG_SISIPAN_MAKS
}

export async function sisipPertanyaan(
  kode: string,
  hostToken: string,
  teks: string,
): Promise<string> {
  const { data, error } = await buatKlienSupabase().rpc('sisip_pertanyaan', {
    p_kode: kode,
    p_host_token: hostToken,
    p_teks: rapikanPertanyaan(teks),
  })
  if (error) throw new Error(error.message)
  return data as string
}

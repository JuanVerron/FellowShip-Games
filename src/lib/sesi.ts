import { buatKlienSupabase } from '@/lib/supabase'

export async function mulaiSesi(kode: string, hostToken: string): Promise<void> {
  const { error } = await buatKlienSupabase().rpc('mulai_sesi', {
    p_kode: kode,
    p_host_token: hostToken,
  })
  if (error) throw new Error(error.message)
}

export async function giliranBerikutnya(
  kode: string,
  hostToken: string,
): Promise<number> {
  const { data, error } = await buatKlienSupabase().rpc('giliran_berikutnya', {
    p_kode: kode,
    p_host_token: hostToken,
  })
  if (error) throw new Error(error.message)
  return data as number
}

export async function ubahOpsiJoinTelat(
  kode: string,
  hostToken: string,
  izinkan: boolean,
): Promise<boolean> {
  const { data, error } = await buatKlienSupabase().rpc('ubah_opsi_join_telat', {
    p_kode: kode,
    p_host_token: hostToken,
    p_izinkan: izinkan,
  })
  if (error) throw new Error(error.message)
  return data as boolean
}

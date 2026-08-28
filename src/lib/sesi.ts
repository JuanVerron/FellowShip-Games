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

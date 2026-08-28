import { buatKlienSupabase } from '@/lib/supabase'

export type PertanyaanKolam = {
  id: string
  teks: string
  urutan: number
  sudahKeluar: boolean
}

export type Putaran = {
  roomQuestionId: string
  teks: string
  nomorGiliran: number
  benihAnimasi: number
}

type BarisKolam = {
  id: string
  teks: string
  urutan: number
  sudah_keluar: boolean
}

type BarisPutaran = {
  room_question_id: string
  nomor_giliran: number
  benih_animasi: number
  room_questions: { teks: string } | { teks: string }[] | null
}

export function keKolam(baris: BarisKolam): PertanyaanKolam {
  return {
    id: baris.id,
    teks: baris.teks,
    urutan: baris.urutan,
    sudahKeluar: baris.sudah_keluar,
  }
}

/**
 * PostgREST mengembalikan relasi bertingkat sebagai objek kalau relasinya
 * tunggal dan sebagai larik kalau jamak, dan tipe hasilnya tidak selalu
 * menebak yang benar. Dinormalkan di satu tempat supaya pemanggilnya tidak
 * perlu tahu bentuk mana yang datang.
 */
export function kePutaran(baris: BarisPutaran): Putaran {
  const pertanyaan = Array.isArray(baris.room_questions)
    ? baris.room_questions[0]
    : baris.room_questions

  return {
    roomQuestionId: baris.room_question_id,
    teks: pertanyaan?.teks ?? '',
    nomorGiliran: baris.nomor_giliran,
    benihAnimasi: baris.benih_animasi,
  }
}

export async function putarRoda(
  kode: string,
  token: string,
  hostToken: string | null,
): Promise<Putaran> {
  const { data, error } = await buatKlienSupabase()
    .rpc('putar_roda', {
      p_kode: kode,
      p_token: token,
      p_host_token: hostToken,
    })
    .single()

  if (error) throw new Error(error.message)

  const hasil = data as {
    room_question_id: string
    teks: string
    nomor_giliran: number
    benih_animasi: number
  }

  return {
    roomQuestionId: hasil.room_question_id,
    teks: hasil.teks,
    nomorGiliran: hasil.nomor_giliran,
    benihAnimasi: hasil.benih_animasi,
  }
}

export async function ambilKolam(roomId: string): Promise<PertanyaanKolam[]> {
  const { data, error } = await buatKlienSupabase()
    .from('room_questions')
    .select('id, teks, urutan, sudah_keluar')
    .eq('room_id', roomId)
    .order('urutan', { ascending: true })

  if (error) throw new Error(error.message)
  return (data as BarisKolam[]).map(keKolam)
}

/**
 * Keadaan roda tidak disimpan di memori browser, tapi selalu dibaca ulang dari
 * putaran terakhir yang tercatat. Inilah yang membuat layar pulih benar setelah
 * dimuat ulang atau setelah HP terkunci lalu dibuka lagi.
 */
export async function ambilPutaranTerakhir(
  roomId: string,
): Promise<Putaran | null> {
  const { data, error } = await buatKlienSupabase()
    .from('spins')
    .select('room_question_id, nomor_giliran, benih_animasi, room_questions(teks)')
    .eq('room_id', roomId)
    .order('nomor_giliran', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  return kePutaran(data as unknown as BarisPutaran)
}

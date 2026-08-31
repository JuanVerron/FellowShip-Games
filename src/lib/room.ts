import type { Identitas } from '@/lib/identitas'
import { buatKlienSupabase } from '@/lib/supabase'

export type StatusRoom = 'lobby' | 'berjalan' | 'selesai'

export type Room = {
  id: string
  kode: string
  status: StatusRoom
  nomorGiliranSekarang: number
  opsiBuangTerpakai: boolean
  opsiIzinkanJoinTelat: boolean
}

export type Peserta = {
  id: string
  nama: string
  urutanGiliran: number | null
  adalahHost: boolean
}

type BarisRoom = {
  id: string
  kode: string
  status: StatusRoom
  nomor_giliran_sekarang: number
  opsi_buang_terpakai: boolean
  opsi_izinkan_join_telat: boolean
}

type BarisPeserta = {
  id: string
  nama: string
  urutan_giliran: number | null
  adalah_host: boolean
}

export function keRoom(baris: BarisRoom): Room {
  return {
    id: baris.id,
    kode: baris.kode,
    status: baris.status,
    nomorGiliranSekarang: baris.nomor_giliran_sekarang,
    opsiBuangTerpakai: baris.opsi_buang_terpakai,
    opsiIzinkanJoinTelat: baris.opsi_izinkan_join_telat,
  }
}

export function kePeserta(baris: BarisPeserta): Peserta {
  return {
    id: baris.id,
    nama: baris.nama,
    urutanGiliran: baris.urutan_giliran,
    adalahHost: baris.adalah_host,
  }
}

// Satu butir kolam. `sumber` dan `bankId` ikut dikirim karena room_questions
// menyimpan asal-usulnya, bukan cuma teksnya.
export type ButirPertanyaan = {
  teks: string
  sumber: 'bank' | 'custom'
  bankId: string | null
}

export async function buatRoom(
  namaHost: string,
  pertanyaan: ButirPertanyaan[],
  opsi: { buangTerpakai: boolean; izinkanJoinTelat: boolean },
): Promise<{ kode: string; identitas: Identitas }> {
  const { data, error } = await buatKlienSupabase()
    .rpc('buat_room', {
      p_nama_host: namaHost,
      p_pertanyaan: pertanyaan,
      p_buang_terpakai: opsi.buangTerpakai,
      p_izinkan_join_telat: opsi.izinkanJoinTelat,
    })
    .single()

  if (error) throw new Error(error.message)

  const hasil = data as {
    room_id: string
    kode: string
    host_token: string
    participant_id: string
    participant_token: string
  }

  return {
    kode: hasil.kode,
    identitas: {
      roomId: hasil.room_id,
      participantId: hasil.participant_id,
      token: hasil.participant_token,
      nama: namaHost,
      hostToken: hasil.host_token,
    },
  }
}

export async function masukRoom(kode: string, nama: string): Promise<Identitas> {
  const { data, error } = await buatKlienSupabase()
    .rpc('masuk_room', { p_kode: kode, p_nama: nama })
    .single()

  if (error) throw new Error(error.message)

  const hasil = data as {
    room_id: string
    participant_id: string
    participant_token: string
  }

  return {
    roomId: hasil.room_id,
    participantId: hasil.participant_id,
    token: hasil.participant_token,
    nama,
    hostToken: null,
  }
}

export async function ambilRoom(kode: string): Promise<Room | null> {
  const { data, error } = await buatKlienSupabase()
    .from('rooms')
    .select('id, kode, status, nomor_giliran_sekarang, opsi_buang_terpakai, opsi_izinkan_join_telat')
    .eq('kode', kode)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? keRoom(data as BarisRoom) : null
}

export async function ambilPeserta(roomId: string): Promise<Peserta[]> {
  const { data, error } = await buatKlienSupabase()
    .from('participants')
    .select('id, nama, urutan_giliran, adalah_host')
    .eq('room_id', roomId)
    .order('bergabung_pada', { ascending: true })

  if (error) throw new Error(error.message)
  return (data as BarisPeserta[]).map(kePeserta)
}

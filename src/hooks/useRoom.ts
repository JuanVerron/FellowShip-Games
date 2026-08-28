'use client'

import { useEffect, useState } from 'react'
import {
  ambilKolam,
  ambilPutaranTerakhir,
  type PertanyaanKolam,
  type Putaran,
} from '@/lib/putaran'
import { ambilPeserta, ambilRoom, type Peserta, type Room } from '@/lib/room'
import { buatKlienSupabase } from '@/lib/supabase'

export type StatusSaluran =
  | 'menyambung'
  | 'tersambung'
  | 'terputus'

function terjemahkanStatus(status: string): StatusSaluran {
  if (status === 'SUBSCRIBED') return 'tersambung'
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
    return 'terputus'
  }
  return 'menyambung'
}

export function useRoom(kode: string) {
  const [room, setRoom] = useState<Room | null>(null)
  const [peserta, setPeserta] = useState<Peserta[]>([])
  const [kolam, setKolam] = useState<PertanyaanKolam[]>([])
  const [putaran, setPutaran] = useState<Putaran | null>(null)
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)
  const [statusSaluran, setStatusSaluran] = useState<StatusSaluran>('menyambung')
  const [diperbaruiPada, setDiperbaruiPada] = useState<number | null>(null)

  useEffect(() => {
    let dibatalkan = false
    const klien = buatKlienSupabase()

    async function muatUlang() {
      try {
        const r = await ambilRoom(kode)
        if (dibatalkan) return
        setRoom(r)

        if (!r) {
          setPeserta([])
          setKolam([])
          setPutaran(null)
          setGalat('Room not found')
          setDiperbaruiPada(Date.now())
          return
        }

        // Ketiganya ditarik bersamaan, bukan berurutan: satu siaran bisa
        // memicu muat ulang beberapa kali per detik, dan tiga perjalanan
        // bolak-balik yang antre terasa jelas di jaringan HP.
        const [daftarPeserta, daftarKolam, putaranTerakhir] = await Promise.all([
          ambilPeserta(r.id),
          ambilKolam(r.id),
          ambilPutaranTerakhir(r.id),
        ])
        if (dibatalkan) return

        setPeserta(daftarPeserta)
        setKolam(daftarKolam)
        setPutaran(putaranTerakhir)
        setGalat(null)
        setDiperbaruiPada(Date.now())
      } catch (e) {
        if (!dibatalkan) setGalat(e instanceof Error ? e.message : 'Could not load room')
      } finally {
        if (!dibatalkan) setMemuat(false)
      }
    }

    void muatUlang()

    const saluran = klien.channel(`room:${kode}`)
    for (const tabel of ['rooms', 'participants', 'room_questions', 'spins']) {
      saluran.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tabel },
        () => void muatUlang(),
      )
    }
    saluran.subscribe((status) => {
      if (!dibatalkan) setStatusSaluran(terjemahkanStatus(status))
    })

    // Browser HP menangguhkan tab yang tidak di depan dan memutus WebSocket-nya.
    // Siaran yang lewat selama itu hilang dan tidak dikirim ulang, jadi begitu
    // tab kembali terlihat keadaannya ditarik ulang alih-alih menunggu siaran
    // berikutnya yang mungkin baru datang lama sesudahnya. Ini bukan polling:
    // dipicu peristiwa, bukan pewaktu.
    function saatKembaliTerlihat() {
      if (document.visibilityState === 'visible') void muatUlang()
    }

    document.addEventListener('visibilitychange', saatKembaliTerlihat)
    window.addEventListener('focus', saatKembaliTerlihat)
    window.addEventListener('online', saatKembaliTerlihat)

    return () => {
      dibatalkan = true
      document.removeEventListener('visibilitychange', saatKembaliTerlihat)
      window.removeEventListener('focus', saatKembaliTerlihat)
      window.removeEventListener('online', saatKembaliTerlihat)
      void klien.removeChannel(saluran)
    }
  }, [kode])

  return {
    room,
    peserta,
    kolam,
    putaran,
    memuat,
    galat,
    statusSaluran,
    diperbaruiPada,
  }
}

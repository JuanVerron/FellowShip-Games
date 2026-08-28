'use client'

import { useEffect, useState } from 'react'
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
        setPeserta(r ? await ambilPeserta(r.id) : [])
        setGalat(r ? null : 'Room not found')
        if (!dibatalkan) setDiperbaruiPada(Date.now())
      } catch (e) {
        if (!dibatalkan) setGalat(e instanceof Error ? e.message : 'Could not load room')
      } finally {
        if (!dibatalkan) setMemuat(false)
      }
    }

    void muatUlang()

    const saluran = klien
      .channel(`room:${kode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants' },
        () => void muatUlang(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        () => void muatUlang(),
      )
      .subscribe((status) => {
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

  return { room, peserta, memuat, galat, statusSaluran, diperbaruiPada }
}

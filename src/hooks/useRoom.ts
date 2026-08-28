'use client'

import { useEffect, useState } from 'react'
import { ambilPeserta, ambilRoom, type Peserta, type Room } from '@/lib/room'
import { buatKlienSupabase } from '@/lib/supabase'

export function useRoom(kode: string) {
  const [room, setRoom] = useState<Room | null>(null)
  const [peserta, setPeserta] = useState<Peserta[]>([])
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    let dibatalkan = false
    const klien = buatKlienSupabase()

    async function muatUlang() {
      try {
        const r = await ambilRoom(kode)
        if (dibatalkan) return
        setRoom(r)
        setPeserta(r ? await ambilPeserta(r.id) : [])
        setGalat(r ? null : 'Room tidak ditemukan')
      } catch (e) {
        if (!dibatalkan) setGalat(e instanceof Error ? e.message : 'Gagal memuat room')
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
      .subscribe()

    return () => {
      dibatalkan = true
      void klien.removeChannel(saluran)
    }
  }, [kode])

  return { room, peserta, memuat, galat }
}

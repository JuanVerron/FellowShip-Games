'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ambilKolam,
  ambilPutaranTerakhir,
  type PertanyaanKolam,
  type Putaran,
} from '@/lib/putaran'
import { ambilPeserta, ambilRoom, type Peserta, type Room } from '@/lib/room'
import {
  perluPasangUlang,
  terjemahkanStatus,
  type StatusSaluran,
} from '@/lib/saluran'
import { buatKlienSupabase } from '@/lib/supabase'

export type { StatusSaluran }

const TABEL_DISIMAK = ['rooms', 'participants', 'room_questions', 'spins'] as const

export function useRoom(kode: string) {
  const [room, setRoom] = useState<Room | null>(null)
  const [peserta, setPeserta] = useState<Peserta[]>([])
  const [kolam, setKolam] = useState<PertanyaanKolam[]>([])
  const [putaran, setPutaran] = useState<Putaran | null>(null)
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)
  const [statusSaluran, setStatusSaluran] = useState<StatusSaluran>('menyambung')
  const [diperbaruiPada, setDiperbaruiPada] = useState<number | null>(null)

  // Diisi oleh efek di bawah, lalu dibuka ke pemanggil lewat pembungkus yang
  // acuannya tetap. `muatUlang` sendiri harus hidup di dalam efek: aturan
  // react-hooks/set-state-in-effect menolak useCallback pemanggil setState
  // yang dipanggil langsung di badan efek.
  const muatUlangRef = useRef<() => void>(() => {})

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
        if (!dibatalkan) {
          setGalat(e instanceof Error ? e.message : 'Could not load room')
        }
      } finally {
        if (!dibatalkan) setMemuat(false)
      }
    }

    muatUlangRef.current = () => void muatUlang()
    let saluran = pasangSaluran()

    function pasangSaluran() {
      const baru = klien.channel(`room:${kode}`)
      for (const tabel of TABEL_DISIMAK) {
        baru.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: tabel },
          () => void muatUlang(),
        )
      }
      baru.subscribe((status) => {
        if (!dibatalkan) setStatusSaluran(terjemahkanStatus(status))
      })
      return baru
    }

    void muatUlang()

    // Browser HP menangguhkan tab yang tidak di depan dan memutus WebSocket-nya.
    // Siaran yang lewat selama itu hilang dan tidak dikirim ulang, jadi begitu
    // tab kembali terlihat keadaannya ditarik ulang alih-alih menunggu siaran
    // berikutnya yang mungkin baru datang lama sesudahnya. Ini bukan polling:
    // dipicu peristiwa, bukan pewaktu.
    //
    // Menarik ulang data saja tidak cukup. Kalau salurannya sendiri sudah mati,
    // layar akan benar sekali lalu diam lagi selamanya karena perubahan
    // berikutnya tidak pernah sampai. Jadi saluran yang mati dibuang dan
    // dipasang ulang di sini.
    function saatKembaliTerlihat() {
      if (document.visibilityState !== 'visible') return
      void muatUlang()

      if (perluPasangUlang(saluran.state)) {
        void klien.removeChannel(saluran)
        saluran = pasangSaluran()
      }
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

  const muatUlangSekarang = useCallback(() => muatUlangRef.current(), [])

  return {
    room,
    peserta,
    kolam,
    putaran,
    memuat,
    galat,
    statusSaluran,
    diperbaruiPada,
    // Dibuka supaya layar bisa menawarkan coba-lagi saat sambungan putus,
    // tanpa memaksa orang memuat ulang seluruh halaman.
    muatUlang: muatUlangSekarang,
  }
}

'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useSyncExternalStore } from 'react'
import { TautanBeranda } from '@/components/TautanBeranda'
import { bacaIdentitas, kunciIdentitas, simpanIdentitas } from '@/lib/identitas'
import { kodeValid, normalisasiKode } from '@/lib/kode'
import { namaValid, rapikanNama } from '@/lib/nama'
import { masukRoom } from '@/lib/room'

function langgananPenyimpanan(beriTahu: () => void): () => void {
  window.addEventListener('storage', beriTahu)
  return () => window.removeEventListener('storage', beriTahu)
}

export default function MasukRoom() {
  const router = useRouter()
  const [kode, setKode] = useState('')
  const [nama, setNama] = useState('')
  const [mengirim, setMengirim] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  // Satu browser hanya boleh punya satu identitas per room. Kalau kodenya
  // pernah dimasuki dari perangkat ini, yang terjadi adalah melanjutkan
  // identitas lama, bukan membuat peserta kedua dengan nama berbeda.
  // Inilah yang membuat host tetap host setelah menutup browser, karena
  // host_token ikut tersimpan bersama identitasnya.
  const identitasMentah = useSyncExternalStore(
    langgananPenyimpanan,
    () => {
      if (!kodeValid(kode)) return null
      try {
        return window.localStorage.getItem(kunciIdentitas(kode))
      } catch {
        return null
      }
    },
    () => null,
  )
  const identitasTersimpan = useMemo(
    () => (identitasMentah && kodeValid(kode) ? bacaIdentitas(kode) : null),
    [identitasMentah, kode],
  )

  async function kirim(peristiwa: React.FormEvent) {
    peristiwa.preventDefault()

    if (!kodeValid(kode)) {
      setGalat('Kode room terdiri dari 5 karakter.')
      return
    }

    if (identitasTersimpan) {
      router.push(`/room/${kode}`)
      return
    }

    const rapi = rapikanNama(nama)
    if (!namaValid(rapi)) {
      setGalat('Nama wajib diisi, maksimal 20 karakter.')
      return
    }

    setMengirim(true)
    setGalat(null)
    try {
      const identitas = await masukRoom(kode, rapi)
      simpanIdentitas(kode, identitas)
      router.push(`/room/${kode}`)
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal masuk room')
      setMengirim(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
      <TautanBeranda />

      <div className="flex flex-1 flex-col justify-center gap-6">
        <h1 className="text-2xl font-bold">Masuk Room</h1>

        <form onSubmit={kirim} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm opacity-70">Kode room</span>
            <input
              value={kode}
              onChange={(e) => setKode(normalisasiKode(e.target.value))}
              autoCapitalize="characters"
              autoFocus
              className="min-h-[56px] rounded-lg border-2 px-3 text-center font-mono text-3xl tracking-[0.3em]"
            />
          </label>

          {identitasTersimpan ? (
            <p className="rounded-lg border-2 border-amber-500 bg-amber-500/10 px-3 py-2 text-sm">
              Kamu sudah pernah masuk room ini sebagai{' '}
              <span className="font-semibold">{identitasTersimpan.nama}</span>
              {identitasTersimpan.hostToken && ' (host)'}. Kamu akan dilanjutkan
              sebagai orang yang sama.
            </p>
          ) : (
            <label className="flex flex-col gap-2">
              <span className="text-sm opacity-70">Nama kamu</span>
              <input
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                maxLength={20}
                className="min-h-[48px] rounded-lg border-2 px-3 text-lg"
              />
            </label>
          )}

          {galat && <p className="text-sm text-red-600">{galat}</p>}

          <button
            type="submit"
            disabled={mengirim}
            className="min-h-[52px] rounded-xl bg-black font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {mengirim
              ? 'Masuk…'
              : identitasTersimpan
                ? `Lanjutkan sebagai ${identitasTersimpan.nama}`
                : 'Masuk'}
          </button>
        </form>
      </div>
    </main>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { TautanBeranda } from '@/components/TautanBeranda'
import { simpanIdentitas } from '@/lib/identitas'
import { namaValid, rapikanNama } from '@/lib/nama'
import { buatRoom } from '@/lib/room'

export default function BuatRoom() {
  const router = useRouter()
  const [nama, setNama] = useState('')
  const [mengirim, setMengirim] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  async function kirim(peristiwa: React.FormEvent) {
    peristiwa.preventDefault()
    const rapi = rapikanNama(nama)
    if (!namaValid(rapi)) {
      setGalat('Nama wajib diisi, maksimal 20 karakter.')
      return
    }

    setMengirim(true)
    setGalat(null)
    try {
      const { kode, identitas } = await buatRoom(rapi)
      simpanIdentitas(kode, identitas)
      router.push(`/room/${kode}`)
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal membuat room')
      setMengirim(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
      <TautanBeranda />

      <div className="flex flex-1 flex-col justify-center gap-6">
        <h1 className="text-2xl font-bold">Buat Room</h1>

        <form onSubmit={kirim} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm opacity-70">Nama kamu</span>
            <input
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              maxLength={20}
              autoFocus
              className="min-h-[48px] rounded-lg border-2 px-3 text-lg"
            />
          </label>

          {galat && <p className="text-sm text-red-600">{galat}</p>}

          <button
            type="submit"
            disabled={mengirim}
            className="min-h-[52px] rounded-xl bg-black font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {mengirim ? 'Membuat…' : 'Buat'}
          </button>
        </form>
      </div>
    </main>
  )
}

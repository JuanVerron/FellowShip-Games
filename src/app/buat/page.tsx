'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { TautanBeranda } from '@/components/TautanBeranda'
import { Tombol } from '@/components/Tombol'
import { CONTOH_PERTANYAAN } from '@/data/contoh-pertanyaan'
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
      setGalat('Name is required, 20 characters max.')
      return
    }

    setMengirim(true)
    setGalat(null)
    try {
      // Sementara: kolam masih dari daftar contoh, dan kedua opsi dikunci
      // di bawaannya. Task 4 menggantinya dengan penjelajah bank dan dua
      // sakelar sungguhan.
      const { kode, identitas } = await buatRoom(
        rapi,
        CONTOH_PERTANYAAN.map((teks) => ({
          teks,
          sumber: 'custom' as const,
          bankId: null,
        })),
        { buangTerpakai: true, izinkanJoinTelat: true },
      )
      simpanIdentitas(kode, identitas)
      router.push(`/room/${kode}`)
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Could not create room')
      setMengirim(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
      <TautanBeranda />

      <div className="flex flex-1 flex-col justify-center gap-6">
        <h1 className="text-2xl font-bold">Create Room</h1>

        <form onSubmit={kirim} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm text-teks-redup">Your name</span>
            <input
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              maxLength={20}
              autoFocus
              className="min-h-[52px] rounded-[var(--radius)] border-2 border-garis-kuat bg-permukaan px-3 text-lg text-teks transition-colors placeholder:text-teks-redup focus:border-aksi-garis"
            />
          </label>

          {galat && (
            <p
              role="alert"
              className="rounded-[var(--radius)] bg-bahaya-lembut px-3 py-2 text-sm text-bahaya"
            >
              {galat}
            </p>
          )}

          <Tombol type="submit" disabled={mengirim} ukuran="besar">
            {mengirim ? 'Creating…' : 'Create'}
          </Tombol>
        </form>
      </div>
    </main>
  )
}

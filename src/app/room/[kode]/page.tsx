'use client'

import { use, useEffect, useState } from 'react'
import { useRoom } from '@/hooks/useRoom'

const WARNA_STATUS = {
  tersambung: 'bg-green-500',
  menyambung: 'bg-amber-500',
  terputus: 'bg-red-500',
} as const

const TEKS_STATUS = {
  tersambung: 'Tersambung langsung',
  menyambung: 'Menyambung…',
  terputus: 'Terputus — tarik layar ke bawah untuk memuat ulang',
} as const

function usiaDetik(sejak: number | null, sekarang: number): number | null {
  return sejak === null ? null : Math.floor((sekarang - sejak) / 1000)
}

export default function RuangTunggu({
  params,
}: {
  params: Promise<{ kode: string }>
}) {
  const { kode } = use(params)
  const { room, peserta, memuat, galat, statusSaluran, diperbaruiPada } =
    useRoom(kode.toUpperCase())

  // Penanda usia ini menghitung sendiri tiap detik supaya "diperbarui N detik
  // lalu" tetap jujur walau tidak ada siaran yang masuk. Kalau angkanya terus
  // membesar sementara ada orang baru bergabung, sinkronisasinya sedang mati.
  const [sekarang, setSekarang] = useState(() => Date.now())
  useEffect(() => {
    const pewaktu = setInterval(() => setSekarang(Date.now()), 1000)
    return () => clearInterval(pewaktu)
  }, [])

  if (memuat) {
    return <main className="p-6">Memuat…</main>
  }

  if (galat || !room) {
    return (
      <main className="mx-auto max-w-md p-6">
        <p className="text-red-600">{galat ?? 'Room tidak ditemukan'}</p>
      </main>
    )
  }

  const usia = usiaDetik(diperbaruiPada, sekarang)

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 p-6">
      <div className="text-center">
        <p className="text-sm opacity-70">Kode room</p>
        <p className="font-mono text-5xl font-bold tracking-[0.3em]">{room.kode}</p>
        <p className="mt-2 text-sm opacity-70">Sebutkan kode ini ke teman-teman</p>
      </div>

      <div>
        <h2 className="mb-3 font-semibold">Peserta ({peserta.length})</h2>
        <ul className="flex flex-col gap-2">
          {peserta.map((orang) => (
            <li
              key={orang.id}
              className="flex min-h-[44px] items-center justify-between rounded-lg border px-3"
            >
              <span>{orang.nama}</span>
              {orang.adalahHost && <span className="text-xs opacity-60">host</span>}
            </li>
          ))}
        </ul>
      </div>

      <p
        role="status"
        className="mt-auto flex items-center gap-2 text-xs opacity-70"
      >
        <span
          className={`inline-block h-2 w-2 shrink-0 rounded-full ${WARNA_STATUS[statusSaluran]}`}
          aria-hidden
        />
        <span>
          {TEKS_STATUS[statusSaluran]}
          {usia !== null && ` · diperbarui ${usia} detik lalu`}
        </span>
      </p>
    </main>
  )
}

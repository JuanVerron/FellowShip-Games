'use client'

import { use } from 'react'
import { useRoom } from '@/hooks/useRoom'

export default function RuangTunggu({
  params,
}: {
  params: Promise<{ kode: string }>
}) {
  const { kode } = use(params)
  const { room, peserta, memuat, galat } = useRoom(kode.toUpperCase())

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

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 p-6">
      <div className="text-center">
        <p className="text-sm opacity-70">Kode room</p>
        <p className="font-mono text-5xl font-bold tracking-[0.3em]">{room.kode}</p>
        <p className="mt-2 text-sm opacity-70">Sebutkan kode ini ke teman-teman</p>
      </div>

      <div>
        <h2 className="mb-3 font-semibold">
          Peserta ({peserta.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {peserta.map((orang) => (
            <li
              key={orang.id}
              className="flex min-h-[44px] items-center justify-between rounded-lg border px-3"
            >
              <span>{orang.nama}</span>
              {orang.adalahHost && (
                <span className="text-xs opacity-60">host</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}

'use client'

import { use, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { TautanBeranda } from '@/components/TautanBeranda'
import { useRoom } from '@/hooks/useRoom'
import {
  bacaIdentitas,
  hapusIdentitas,
  identitasMasihSah,
  kunciIdentitas,
} from '@/lib/identitas'

const WARNA_STATUS = {
  tersambung: 'bg-green-500',
  menyambung: 'bg-amber-500',
  terputus: 'bg-red-500',
} as const

const TEKS_STATUS = {
  tersambung: 'Live',
  menyambung: 'Connecting…',
  terputus: 'Disconnected — reload the page',
} as const

// Penyimpanan browser hanya menyiarkan peristiwa 'storage' ke tab lain, bukan
// ke tab yang mengubahnya. Itu sudah cukup di sini: identitas hanya berubah
// saat masuk room, dan saat itu halamannya memang dimuat ulang.
function langgananPenyimpanan(beriTahu: () => void): () => void {
  window.addEventListener('storage', beriTahu)
  return () => window.removeEventListener('storage', beriTahu)
}

function usiaDetik(sejak: number | null, sekarang: number): number | null {
  return sejak === null ? null : Math.floor((sekarang - sejak) / 1000)
}

export default function RuangTunggu({
  params,
}: {
  params: Promise<{ kode: string }>
}) {
  const { kode } = use(params)
  const kodeBesar = kode.toUpperCase()
  const { room, peserta, memuat, galat, statusSaluran, diperbaruiPada } =
    useRoom(kodeBesar)

  // Identitas hidup di localStorage, yang tidak ada saat halaman dirender di
  // server. useSyncExternalStore memang dibuat untuk ini: render di server
  // memakai getServerSnapshot yang mengembalikan null, browser membaca nilai
  // sebenarnya, dan React menjahit keduanya tanpa hidrasi yang pecah.
  // Yang dibaca sengaja teks mentahnya, bukan objek hasil parse, karena
  // snapshot wajib stabil antar panggilan; objek baru tiap kali akan membuat
  // React merender tanpa henti.
  const identitasMentah = useSyncExternalStore(
    langgananPenyimpanan,
    () => {
      try {
        return window.localStorage.getItem(kunciIdentitas(kodeBesar))
      } catch {
        return null
      }
    },
    () => null,
  )
  const identitas = useMemo(
    () => (identitasMentah ? bacaIdentitas(kodeBesar) : null),
    [identitasMentah, kodeBesar],
  )

  // Identitas yang menunjuk peserta yang sudah tidak ada dibuang, supaya
  // orangnya bisa masuk lagi sebagai peserta baru alih-alih terjebak di room
  // yang menganggapnya bukan siapa-siapa.
  useEffect(() => {
    if (memuat || peserta.length === 0 || identitas === null) return
    if (!identitasMasihSah(identitas, peserta.map((o) => o.id))) {
      hapusIdentitas(kodeBesar)
    }
  }, [memuat, peserta, identitas, kodeBesar])

  const [sekarang, setSekarang] = useState(() => Date.now())
  useEffect(() => {
    const pewaktu = setInterval(() => setSekarang(Date.now()), 1000)
    return () => clearInterval(pewaktu)
  }, [])

  if (memuat) {
    return (
      <main className="mx-auto flex max-w-md flex-col p-6">
        <TautanBeranda />
        <p className="mt-4">Loading…</p>
      </main>
    )
  }

  if (galat || !room) {
    return (
      <main className="mx-auto flex max-w-md flex-col p-6">
        <TautanBeranda />
        <p className="mt-4 text-red-600">{galat ?? 'Room not found'}</p>
      </main>
    )
  }

  const usia = usiaDetik(diperbaruiPada, sekarang)

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <TautanBeranda />

      <div className="text-center">
        <p className="text-sm opacity-70">Room code</p>
        <p className="font-mono text-5xl font-bold tracking-[0.3em]">{room.kode}</p>
        <p className="mt-2 text-sm opacity-70">Share this code with your friends</p>
      </div>

      <div>
        <h2 className="mb-3 font-semibold">Participants ({peserta.length})</h2>
        <ul className="flex flex-col gap-2">
          {peserta.map((orang) => {
            const iniKamu = identitas?.participantId === orang.id
            return (
              <li
                key={orang.id}
                aria-current={iniKamu ? 'true' : undefined}
                className={
                  iniKamu
                    ? 'flex min-h-[44px] items-center justify-between gap-2 rounded-lg border-2 border-amber-500 bg-amber-500/10 px-3 font-semibold'
                    : 'flex min-h-[44px] items-center justify-between gap-2 rounded-lg border px-3'
                }
              >
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span className="truncate">{orang.nama}</span>
                  {iniKamu && (
                    <span className="shrink-0 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      (you)
                    </span>
                  )}
                </span>
                {orang.adalahHost && (
                  <span className="shrink-0 text-xs font-normal opacity-60">
                    host
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <p role="status" className="mt-auto flex items-center gap-2 text-xs opacity-70">
        <span
          className={`inline-block h-2 w-2 shrink-0 rounded-full ${WARNA_STATUS[statusSaluran]}`}
          aria-hidden
        />
        <span>
          {TEKS_STATUS[statusSaluran]}
          {usia !== null && ` · updated ${usia}s ago`}
        </span>
      </p>
    </main>
  )
}

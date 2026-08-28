'use client'

import { useState } from 'react'
import { sudutKumulatif, sudutSegmen } from '@/lib/roda'

const WARNA = [
  '#dc2626', '#ea580c', '#ca8a04', '#16a34a',
  '#0891b2', '#2563eb', '#7c3aed', '#db2777',
]

// Label di roda sengaja dipotong pendek. Pertanyaan utuh tidak mungkin terbaca
// di segmen roda pada layar 360px; roda tugasnya menunjukkan bahwa undiannya
// nyata, dan teks utuhnya tampil besar di bawah setelah berhenti.
function potong(teks: string, panjang = 18): string {
  return teks.length <= panjang ? teks : `${teks.slice(0, panjang - 1)}…`
}

export function Roda({
  daftar,
  indeksTerpilih,
  benih,
  nomorGiliran,
}: {
  daftar: string[]
  indeksTerpilih: number | null
  benih: number
  nomorGiliran: number | null
}) {
  // Nomor giliran yang sudah ada saat komponen ini pertama tampil adalah
  // keadaan pulihan, bukan putaran baru: layar yang baru dimuat ulang harus
  // langsung menunjukkan hasil terakhir, bukan memutar ulang animasinya.
  // Disimpan sebagai state awal, bukan ref, supaya nilainya ditentukan sekali
  // di render pertama dan tidak bergeser saat efek dijalankan dua kali di dev.
  const [giliranSaatMuat] = useState(() => nomorGiliran)
  const beranimasi = nomorGiliran !== null && nomorGiliran !== giliranSaatMuat

  if (daftar.length === 0) {
    return (
      <p className="py-10 text-center opacity-60">This room has no questions.</p>
    )
  }

  const segmen = sudutSegmen(daftar.length)
  const gradien = daftar
    .map((_, i) => {
      const warna = WARNA[i % WARNA.length]
      return `${warna} ${i * segmen}deg ${(i + 1) * segmen}deg`
    })
    .join(', ')

  const sudut =
    indeksTerpilih === null || nomorGiliran === null
      ? 0
      : sudutKumulatif(indeksTerpilih, daftar.length, benih, nomorGiliran)

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px]">
      <div
        aria-hidden
        className="absolute left-1/2 top-[-10px] z-10 -translate-x-1/2 text-3xl leading-none drop-shadow"
      >
        ▼
      </div>

      <div
        className={`h-full w-full overflow-hidden rounded-full border-4 border-black/10 dark:border-white/20${
          beranimasi
            ? ' motion-safe:transition-transform motion-safe:duration-[4000ms] motion-safe:ease-out'
            : ''
        }`}
        style={{
          background: `conic-gradient(${gradien})`,
          transform: `rotate(${sudut}deg)`,
        }}
      >
        {daftar.map((teks, i) => (
          <div
            key={i}
            aria-hidden
            className="absolute left-1/2 top-1/2 flex w-1/2 origin-left items-center pl-7 pr-2"
            style={{
              // conic-gradient mulai dari jam 12, sementara rotate() di CSS
              // mulai dari sumbu X yang menunjuk jam 3. Selisih 90 derajat itu
              // yang membuat label sejajar dengan segmennya, bukan meleset
              // seperempat lingkaran.
              transform: `translateY(-50%) rotate(${
                i * segmen + segmen / 2 - 90
              }deg)`,
            }}
          >
            <span className="truncate text-[10px] font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.55)]">
              {potong(teks)}
            </span>
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow dark:bg-neutral-900" />
    </div>
  )
}

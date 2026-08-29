'use client'

import type { ReactNode } from 'react'

/**
 * Sakelar opsi room.
 *
 * Yang digambar cuma jalur dan bulatannya; yang menerima sentuhan, papan
 * ketik, dan pembaca layar tetap `input type="checkbox"` sungguhan. Sakelar
 * yang dibuat dari `div` plus `onClick` terlihat sama tapi tidak bisa
 * ditekan spasi dan tidak mengumumkan keadaannya.
 *
 * Keadaannya tidak disampaikan lewat warna saja: posisi bulatannya bergeser,
 * dan kalimat penjelasnya ikut berubah.
 */
export function Sakelar({
  judul,
  keterangan,
  nyala,
  onUbah,
  disabled = false,
}: {
  judul: string
  keterangan: ReactNode
  nyala: boolean
  onUbah: (nyala: boolean) => void
  disabled?: boolean
}) {
  return (
    <label
      className={`flex min-h-[64px] items-center justify-between gap-4 rounded-[var(--radius)] border-2 border-garis bg-permukaan px-4 py-3 ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      }`}
    >
      <span className="min-w-0">
        <span className="block font-medium">{judul}</span>
        <span className="mt-0.5 block text-sm text-teks-redup">{keterangan}</span>
      </span>

      <input
        type="checkbox"
        className="peer sr-only"
        checked={nyala}
        disabled={disabled}
        onChange={(e) => onUbah(e.target.checked)}
      />

      {/* Bulatannya anak dari jalur, bukan saudara dari input, jadi keadaan
          tercentang diteruskan lewat pemilih anak — `peer-checked:` sendirian
          tidak akan sampai ke sana. */}
      <span
        aria-hidden
        className="relative h-8 w-[3.25rem] shrink-0 rounded-full border-2 border-garis-kuat bg-latar transition-colors peer-checked:border-aksi-garis peer-checked:bg-aksi peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-aksi-garis peer-checked:[&>span]:translate-x-[1.25rem] peer-checked:[&>span]:bg-aksi-teks"
      >
        <span className="absolute left-[3px] top-[3px] h-[1.375rem] w-[1.375rem] rounded-full bg-garis-kuat motion-safe:transition-transform motion-safe:duration-150" />
      </span>
    </label>
  )
}

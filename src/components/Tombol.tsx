import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

export type VarianTombol = 'utama' | 'kedua'
export type UkuranTombol = 'sedang' | 'besar'

/**
 * Sebelum ini, tiap tombol menyalin sendiri untaian kelasnya. Enam salinan
 * berarti enam tempat yang bisa bergeser sendiri-sendiri, dan itulah kenapa
 * satu tombol bisa terlihat redup sementara tetangganya tidak. Sekarang
 * bentuknya diputuskan di satu tempat.
 */
const DASAR =
  'inline-flex select-none items-center justify-center gap-2 rounded-[var(--radius)] ' +
  'px-5 text-center font-semibold leading-tight ' +
  'border-2 transition-[transform,background-color,border-color] duration-150 ' +
  'motion-safe:active:scale-[0.985] ' +
  'disabled:cursor-not-allowed disabled:border-garis disabled:bg-garis ' +
  'disabled:text-teks-redup motion-safe:disabled:active:scale-100'

const VARIAN: Record<VarianTombol, string> = {
  // Satu-satunya hal di layar yang berwarna oranye pekat. Kelangkaan itulah
  // yang membuatnya langsung ketemu mata.
  utama:
    'bg-aksi text-aksi-teks border-aksi-garis hover:bg-aksi-pekat hover:border-aksi-pekat',
  // Bukan sekadar garis tepi di atas latar kosong. Tombol yang cuma bergaris
  // tampak setengah mati di layar gelap, apalagi di bawah matahari.
  kedua:
    'bg-permukaan text-teks border-garis-kuat hover:border-aksi-garis hover:text-aksi-garis',
}

const UKURAN: Record<UkuranTombol, string> = {
  sedang: 'min-h-[52px] text-base',
  besar: 'min-h-[72px] text-xl tracking-wide',
}

export function kelasTombol(
  varian: VarianTombol = 'utama',
  ukuran: UkuranTombol = 'sedang',
  tambahan = '',
): string {
  return `${DASAR} ${VARIAN[varian]} ${UKURAN[ukuran]} ${tambahan}`.trim()
}

export function Tombol({
  varian = 'utama',
  ukuran = 'sedang',
  className = '',
  children,
  ...sisanya
}: ComponentProps<'button'> & {
  varian?: VarianTombol
  ukuran?: UkuranTombol
  children: ReactNode
}) {
  return (
    <button className={kelasTombol(varian, ukuran, className)} {...sisanya}>
      {children}
    </button>
  )
}

export function TautanTombol({
  varian = 'utama',
  ukuran = 'sedang',
  className = '',
  children,
  ...sisanya
}: ComponentProps<typeof Link> & {
  varian?: VarianTombol
  ukuran?: UkuranTombol
  children: ReactNode
}) {
  return (
    <Link className={kelasTombol(varian, ukuran, className)} {...sisanya}>
      {children}
    </Link>
  )
}

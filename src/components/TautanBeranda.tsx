import Link from 'next/link'

/**
 * Tautan kembali ke beranda. Sasaran sentuhnya 44px penuh sesuai batasan di
 * CLAUDE.md, sementara `-ml-2` menarik kotaknya keluar sehingga teksnya tetap
 * lurus dengan tepi konten — sasaran sentuh yang lega tanpa terlihat menjorok.
 */
export function TautanBeranda() {
  return (
    <Link
      href="/"
      className="-ml-2 inline-flex min-h-[44px] shrink-0 items-center gap-1.5 self-start rounded-lg px-2 text-sm text-teks-redup transition-colors hover:text-teks"
    >
      <span aria-hidden>&larr;</span>
      Home
    </Link>
  )
}

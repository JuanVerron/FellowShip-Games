import type { Peserta } from '@/lib/room'

/**
 * Peserta yang sudah punya urutan giliran, terurut. Yang belum punya urutan
 * dibuang: mereka bergabung sebelum sesi dimulai dan baru dapat urutan saat
 * host menekan Mulai.
 *
 * Menyalin dulu sebelum mengurutkan. `sort` mengubah lariknya di tempat, dan
 * larik yang masuk ke sini datang langsung dari state React — mengubahnya
 * berarti mengubah state tanpa lewat setter.
 */
export function pesertaTerurut(peserta: Peserta[]): Peserta[] {
  return peserta
    .filter((orang) => orang.urutanGiliran !== null)
    .slice()
    .sort((a, b) => (a.urutanGiliran ?? 0) - (b.urutanGiliran ?? 0))
}

/**
 * Perhitungan yang sama dengan fungsi `pemilik_giliran` di database. Sengaja
 * dikerjakan dua kali: yang di sini menentukan tampilan, yang di database
 * menentukan siapa yang benar-benar boleh memutar.
 */
export function pemilikGiliran(
  peserta: Peserta[],
  nomorGiliran: number,
): Peserta | null {
  const terurut = pesertaTerurut(peserta)
  if (terurut.length === 0) return null
  return terurut[nomorGiliran % terurut.length]
}

export function bolehMemutar({
  participantId,
  adalahHost,
  pemilik,
}: {
  participantId: string | null
  adalahHost: boolean
  pemilik: Peserta | null
}): boolean {
  if (!participantId) return false
  if (adalahHost) return true
  return pemilik?.id === participantId
}

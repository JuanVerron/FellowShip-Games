export const PUTARAN_MINIMAL = 4
export const RAGAM_PUTARAN = 3

export function sudutSegmen(jumlah: number): number {
  if (jumlah < 1) throw new Error('This room has no questions left.')
  return 360 / jumlah
}

/**
 * Sudut akhir roda untuk satu hasil putaran. Murni: benih yang sama selalu
 * memberi sudut yang sama, dan itulah yang membuat semua layar berhenti di
 * posisi identik tanpa saling bertukar apa pun selain benihnya.
 *
 * Penjagaan kolam kosong ada di sudutSegmen dan sengaja berupa galat, bukan
 * nilai bawaan: pembagian dengan nol di JavaScript menghasilkan Infinity, dan
 * Infinity yang masuk ke transform: rotate() membuat roda hilang dari layar
 * tanpa satu pun pesan galat.
 */
export function sudutAkhir(
  indeks: number,
  jumlah: number,
  benih: number,
): number {
  const segmen = sudutSegmen(jumlah)
  const tengahSegmen = indeks * segmen + segmen / 2
  const putaran = PUTARAN_MINIMAL + (Math.abs(benih) % RAGAM_PUTARAN)
  return putaran * 360 + (360 - tengahSegmen)
}

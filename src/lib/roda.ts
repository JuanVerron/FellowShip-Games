export const PUTARAN_MINIMAL = 4
export const RAGAM_PUTARAN = 3

// Batas atas jumlah putaran penuh yang mungkin dihasilkan sudutAkhir.
export const PUTARAN_MAKSIMAL = PUTARAN_MINIMAL + RAGAM_PUTARAN

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

/**
 * Sudut yang terus bertambah dari giliran ke giliran.
 *
 * sudutAkhir sendirian tidak cukup: sudut giliran berikutnya bisa lebih kecil
 * dari giliran sekarang, dan CSS akan memutar roda ke arah sebaliknya. Roda
 * roulette yang berputar mundur terlihat rusak, meski segmen yang didapat
 * sudah benar.
 *
 * Kelipatan PUTARAN_MAKSIMAL * 360 lebih besar dari jarak antara sudut
 * terkecil dan terbesar yang mungkin, jadi hasilnya dijamin naik terus.
 * Karena kelipatannya bulat dalam 360, posisi berhenti roda tidak bergeser
 * sedikit pun — dan karena nomor giliran sama di semua layar, semua layar
 * tetap sampai di sudut yang identik.
 */
export function sudutKumulatif(
  indeks: number,
  jumlah: number,
  benih: number,
  nomorGiliran: number,
): number {
  return (
    Math.max(0, nomorGiliran) * PUTARAN_MAKSIMAL * 360 +
    sudutAkhir(indeks, jumlah, benih)
  )
}

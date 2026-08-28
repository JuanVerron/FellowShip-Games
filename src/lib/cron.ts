import { createHash, timingSafeEqual } from 'node:crypto'

export type HasilOtorisasi = { boleh: true } | { boleh: false; alasan: string }

const AWALAN = 'Bearer '

/**
 * Membandingkan lewat ringkasan SHA-256 supaya panjangnya selalu sama, jadi
 * `timingSafeEqual` tidak pernah melempar galat dan lama perbandingannya tidak
 * ikut membocorkan berapa banyak karakter awal yang sudah tertebak benar.
 */
function samaTanpaBocorWaktu(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest(),
  )
}

export function otorisasiCron(
  headerOtorisasi: string | null,
  rahasia: string | undefined,
): HasilOtorisasi {
  // Menolak saat rahasianya belum diatur itu disengaja. Kalau dibiarkan lewat,
  // penyerang cukup mengirim "Bearer undefined" untuk lolos.
  if (!rahasia) {
    return { boleh: false, alasan: 'CRON_SECRET belum diatur' }
  }

  if (!headerOtorisasi || !headerOtorisasi.startsWith(AWALAN)) {
    return { boleh: false, alasan: 'header Authorization tidak cocok' }
  }

  if (!samaTanpaBocorWaktu(headerOtorisasi.slice(AWALAN.length), rahasia)) {
    return { boleh: false, alasan: 'header Authorization tidak cocok' }
  }

  return { boleh: true }
}

export type StatusSaluran = 'menyambung' | 'tersambung' | 'terputus'

export function terjemahkanStatus(status: string): StatusSaluran {
  if (status === 'SUBSCRIBED') return 'tersambung'
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
    return 'terputus'
  }
  return 'menyambung'
}

/**
 * Apakah saluran perlu dibuang dan dipasang ulang.
 *
 * Saluran yang mati tidak bangun sendiri. HP yang dikunci beberapa menit bisa
 * kembali dengan saluran ber-state `closed` atau `errored`, dan layarnya akan
 * diam selamanya kalau tidak ada yang memasangnya ulang — menarik ulang data
 * sekali saja tidak cukup, karena perubahan berikutnya tetap tidak sampai.
 *
 * `joining` sengaja dibiarkan: memasang ulang di tengah jalan membuang
 * sambungan yang hampir jadi lalu memulai lagi dari nol.
 */
export function perluPasangUlang(state: string): boolean {
  return state !== 'joined' && state !== 'joining'
}

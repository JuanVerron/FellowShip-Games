export const HURUF_KODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const PANJANG_KODE = 5

export function normalisasiKode(masukan: string): string {
  return masukan
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, PANJANG_KODE)
}

export function kodeValid(kode: string): boolean {
  if (kode.length !== PANJANG_KODE) return false
  return [...kode].every((karakter) => HURUF_KODE.includes(karakter))
}

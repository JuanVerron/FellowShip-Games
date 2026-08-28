export const PANJANG_NAMA_MAKS = 20

export function rapikanNama(masukan: string): string {
  return masukan.trim().replace(/\s+/g, ' ')
}

export function namaValid(nama: string): boolean {
  const rapi = rapikanNama(nama)
  return rapi.length >= 1 && rapi.length <= PANJANG_NAMA_MAKS
}

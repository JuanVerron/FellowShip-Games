export type KeadaanCentang = 'kosong' | 'sebagian' | 'penuh'

export function keadaanCentang(
  id: string[],
  terpilih: Set<string>,
): KeadaanCentang {
  if (id.length === 0) return 'kosong'
  const jumlah = id.filter((satu) => terpilih.has(satu)).length
  if (jumlah === 0) return 'kosong'
  return jumlah === id.length ? 'penuh' : 'sebagian'
}

// Satu ketukan pada tema atau sub-tema.
//
// Yang setengah tercentang MENAMBAH sisanya, tidak mengosongkan. Kalau
// kebalikannya, orang yang sudah susah payah memilih beberapa pertanyaan
// satuan kehilangan semuanya karena satu ketukan salah.
//
// Selalu mengembalikan himpunan baru supaya React melihat perubahannya.
export function alihkan(id: string[], terpilih: Set<string>): Set<string> {
  const baru = new Set(terpilih)
  if (keadaanCentang(id, terpilih) === 'penuh') {
    for (const satu of id) baru.delete(satu)
  } else {
    for (const satu of id) baru.add(satu)
  }
  return baru
}

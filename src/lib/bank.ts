import type { PertanyaanBank } from '@/data/bank-pertanyaan'

export type SubTema = { nama: string; pertanyaan: PertanyaanBank[] }
export type Tema = { nama: string; subTema: SubTema[] }

// Mengubah larik datar jadi pohon dua tingkat. Murni, tanpa I/O.
//
// Urutan tema dan sub-tema mengikuti kemunculan pertama di bank, bukan abjad.
// Itu membuat urutan accordion jadi keputusan yang terlihat di berkas bank,
// bukan sesuatu yang berubah diam-diam saat sebuah tema diganti namanya.
export function kelompokkanBank(bank: PertanyaanBank[]): Tema[] {
  const pohon: Tema[] = []

  for (const pertanyaan of bank) {
    let tema = pohon.find((t) => t.nama === pertanyaan.tema)
    if (!tema) {
      tema = { nama: pertanyaan.tema, subTema: [] }
      pohon.push(tema)
    }

    let sub = tema.subTema.find((s) => s.nama === pertanyaan.subTema)
    if (!sub) {
      sub = { nama: pertanyaan.subTema, pertanyaan: [] }
      tema.subTema.push(sub)
    }

    sub.pertanyaan.push(pertanyaan)
  }

  return pohon
}

export function idDiSubTema(sub: SubTema): string[] {
  return sub.pertanyaan.map((p) => p.id)
}

export function idDiTema(tema: Tema): string[] {
  return tema.subTema.flatMap(idDiSubTema)
}

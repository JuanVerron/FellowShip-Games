import { describe, expect, it } from 'vitest'
import { idDiSubTema, idDiTema, kelompokkanBank } from '@/lib/bank'
import type { PertanyaanBank } from '@/data/bank-pertanyaan'

const contoh: PertanyaanBank[] = [
  { id: 'a-1', tema: 'A', subTema: 'X', teks: 'p1?' },
  { id: 'b-1', tema: 'B', subTema: 'Y', teks: 'p2?' },
  { id: 'a-2', tema: 'A', subTema: 'X', teks: 'p3?' },
  { id: 'a-3', tema: 'A', subTema: 'Z', teks: 'p4?' },
]

describe('kelompokkanBank', () => {
  it('mengelompokkan jadi pohon dua tingkat', () => {
    const pohon = kelompokkanBank(contoh)
    expect(pohon.map((t) => t.nama)).toEqual(['A', 'B'])
    expect(pohon[0].subTema.map((s) => s.nama)).toEqual(['X', 'Z'])
    expect(pohon[0].subTema[0].pertanyaan.map((p) => p.id)).toEqual(['a-1', 'a-2'])
  })

  it('mempertahankan urutan kemunculan pertama, bukan urutan abjad', () => {
    const pohon = kelompokkanBank([contoh[1], contoh[0]])
    expect(pohon.map((t) => t.nama)).toEqual(['B', 'A'])
  })

  it('mengembalikan larik kosong untuk bank kosong', () => {
    expect(kelompokkanBank([])).toEqual([])
  })
})

describe('idDiSubTema dan idDiTema', () => {
  it('mengumpulkan id satu sub-tema', () => {
    const pohon = kelompokkanBank(contoh)
    expect(idDiSubTema(pohon[0].subTema[0])).toEqual(['a-1', 'a-2'])
  })

  it('mengumpulkan id seluruh sub-tema di bawah satu tema', () => {
    const pohon = kelompokkanBank(contoh)
    expect(idDiTema(pohon[0])).toEqual(['a-1', 'a-2', 'a-3'])
  })
})

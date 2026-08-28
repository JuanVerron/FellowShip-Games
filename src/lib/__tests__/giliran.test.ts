import { describe, expect, it } from 'vitest'
import { bolehMemutar, pemilikGiliran, pesertaTerurut } from '@/lib/giliran'
import type { Peserta } from '@/lib/room'

function orang(id: string, urutanGiliran: number | null): Peserta {
  return { id, nama: id, urutanGiliran, adalahHost: false }
}

describe('pesertaTerurut', () => {
  it('mengurutkan menurut urutan giliran', () => {
    const hasil = pesertaTerurut([orang('c', 2), orang('a', 0), orang('b', 1)])
    expect(hasil.map((o) => o.id)).toEqual(['a', 'b', 'c'])
  })

  it('membuang peserta yang belum punya urutan', () => {
    const hasil = pesertaTerurut([orang('a', 0), orang('x', null)])
    expect(hasil.map((o) => o.id)).toEqual(['a'])
  })

  it('tidak mengubah larik yang diberikan', () => {
    const asli = [orang('c', 2), orang('a', 0)]
    pesertaTerurut(asli)
    expect(asli.map((o) => o.id)).toEqual(['c', 'a'])
  })
})

describe('pemilikGiliran', () => {
  const daftar = [orang('a', 0), orang('b', 1), orang('c', 2)]

  it('memilih orang pertama di giliran nol', () => {
    expect(pemilikGiliran(daftar, 0)?.id).toBe('a')
  })

  it('berputar kembali ke awal setelah orang terakhir', () => {
    expect(pemilikGiliran(daftar, 3)?.id).toBe('a')
    expect(pemilikGiliran(daftar, 4)?.id).toBe('b')
  })

  it('mengembalikan null saat belum ada yang punya urutan', () => {
    expect(pemilikGiliran([orang('x', null)], 0)).toBeNull()
  })

  it('mengembalikan null saat tidak ada peserta sama sekali', () => {
    expect(pemilikGiliran([], 0)).toBeNull()
  })
})

describe('bolehMemutar', () => {
  const pemilik = orang('a', 0)

  it('mengizinkan pemilik giliran', () => {
    expect(bolehMemutar({ participantId: 'a', adalahHost: false, pemilik })).toBe(true)
  })

  it('menolak peserta lain', () => {
    expect(bolehMemutar({ participantId: 'b', adalahHost: false, pemilik })).toBe(false)
  })

  it('mengizinkan host walau bukan gilirannya', () => {
    expect(bolehMemutar({ participantId: 'b', adalahHost: true, pemilik })).toBe(true)
  })

  it('menolak orang yang belum punya identitas', () => {
    expect(bolehMemutar({ participantId: null, adalahHost: false, pemilik })).toBe(false)
  })

  it('menolak orang yang belum punya identitas walau host tokennya ada', () => {
    expect(bolehMemutar({ participantId: null, adalahHost: true, pemilik })).toBe(false)
  })

  it('menolak peserta biasa saat belum ada pemilik giliran', () => {
    expect(bolehMemutar({ participantId: 'a', adalahHost: false, pemilik: null })).toBe(
      false,
    )
  })
})

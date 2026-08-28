import { describe, expect, it } from 'vitest'
import { sudutAkhir, sudutKumulatif, sudutSegmen } from '@/lib/roda'

describe('sudutSegmen', () => {
  it('membagi lingkaran rata', () => {
    expect(sudutSegmen(4)).toBe(90)
    expect(sudutSegmen(8)).toBe(45)
  })
})

describe('sudutAkhir', () => {
  it('mendaratkan segmen pertama di penunjuk atas', () => {
    expect(sudutAkhir(0, 4, 0)).toBe(4 * 360 + 315)
  })

  it('menggeser satu segmen untuk indeks berikutnya', () => {
    expect(sudutAkhir(1, 4, 0)).toBe(4 * 360 + 225)
  })

  it('menambah jumlah putaran sesuai benih supaya tidak monoton', () => {
    expect(sudutAkhir(0, 4, 1)).toBe(5 * 360 + 315)
    expect(sudutAkhir(0, 4, 2)).toBe(6 * 360 + 315)
  })

  it('mengulang jumlah putaran setiap tiga benih', () => {
    expect(sudutAkhir(0, 4, 3)).toBe(sudutAkhir(0, 4, 0))
  })

  it('menolak kolam kosong alih-alih membagi dengan nol', () => {
    expect(() => sudutAkhir(0, 0, 0)).toThrow()
  })
})

describe('sudutKumulatif', () => {
  it('sama dengan sudutAkhir di giliran pertama', () => {
    expect(sudutKumulatif(2, 8, 5, 0)).toBe(sudutAkhir(2, 8, 5))
  })

  it('tidak pernah mundur, berapa pun benih dan segmennya', () => {
    let sebelumnya = -1
    for (let giliran = 0; giliran < 40; giliran += 1) {
      const sekarang = sudutKumulatif(giliran % 8, 8, giliran * 7, giliran)
      expect(sekarang).toBeGreaterThan(sebelumnya)
      sebelumnya = sekarang
    }
  })

  it('berhenti di posisi yang sama seperti sudutAkhir', () => {
    for (let giliran = 0; giliran < 5; giliran += 1) {
      expect(sudutKumulatif(3, 8, 2, giliran) % 360).toBe(sudutAkhir(3, 8, 2) % 360)
    }
  })
})

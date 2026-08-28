import { describe, expect, it } from 'vitest'
import { kodeValid, normalisasiKode } from '@/lib/kode'

describe('normalisasiKode', () => {
  it('menjadikan huruf besar dan membuang spasi', () => {
    expect(normalisasiKode(' ab2 cd ')).toBe('AB2CD')
  })

  it('membuang karakter selain huruf dan angka', () => {
    expect(normalisasiKode('a-b#2/c')).toBe('AB2C')
  })

  it('memotong di 5 karakter', () => {
    expect(normalisasiKode('ABCDEFGH')).toBe('ABCDE')
  })
})

describe('kodeValid', () => {
  it('menerima 5 karakter dari himpunan yang dipakai', () => {
    expect(kodeValid('AB2CD')).toBe(true)
  })

  it('menolak yang kurang dari 5 karakter', () => {
    expect(kodeValid('AB2C')).toBe(false)
  })

  it('menolak karakter yang sengaja dibuang karena mirip', () => {
    expect(kodeValid('ABOCD')).toBe(false)
    expect(kodeValid('AB1CD')).toBe(false)
  })
})

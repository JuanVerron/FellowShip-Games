import { describe, expect, it } from 'vitest'
import { perluPasangUlang, terjemahkanStatus } from '@/lib/saluran'

describe('terjemahkanStatus', () => {
  it('menganggap SUBSCRIBED sebagai tersambung', () => {
    expect(terjemahkanStatus('SUBSCRIBED')).toBe('tersambung')
  })

  it('menganggap galat, waktu habis, dan tertutup sebagai terputus', () => {
    expect(terjemahkanStatus('CHANNEL_ERROR')).toBe('terputus')
    expect(terjemahkanStatus('TIMED_OUT')).toBe('terputus')
    expect(terjemahkanStatus('CLOSED')).toBe('terputus')
  })

  it('menganggap apa pun yang lain sebagai sedang menyambung', () => {
    expect(terjemahkanStatus('JOINING')).toBe('menyambung')
    expect(terjemahkanStatus('entah apa')).toBe('menyambung')
  })
})

describe('perluPasangUlang', () => {
  // Saluran yang mati tidak bangun sendiri. HP yang dikunci beberapa menit
  // bisa kembali dengan saluran ber-state `closed`, dan layarnya akan diam
  // selamanya kalau tidak ada yang memasangnya ulang.
  it('meminta pasang ulang untuk saluran yang sudah mati', () => {
    expect(perluPasangUlang('closed')).toBe(true)
    expect(perluPasangUlang('errored')).toBe(true)
    expect(perluPasangUlang('leaving')).toBe(true)
  })

  it('membiarkan saluran yang sehat', () => {
    expect(perluPasangUlang('joined')).toBe(false)
  })

  // Memasang ulang saluran yang sedang menyambung membuang sambungan yang
  // hampir jadi, lalu memulai lagi dari nol.
  it('membiarkan saluran yang masih dalam perjalanan', () => {
    expect(perluPasangUlang('joining')).toBe(false)
  })
})

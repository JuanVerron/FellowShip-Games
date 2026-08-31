import { describe, expect, it } from 'vitest'
import {
  PANJANG_SISIPAN_MAKS,
  pertanyaanValid,
  rapikanPertanyaan,
} from '@/lib/sisipan'

describe('rapikanPertanyaan', () => {
  it('membuang spasi ujung dan merapatkan spasi ganda', () => {
    expect(rapikanPertanyaan('  Apa   kabar? ')).toBe('Apa kabar?')
  })

  it('mengganti baris baru dengan spasi supaya tetap satu pertanyaan', () => {
    expect(rapikanPertanyaan('Apa\nkabar?')).toBe('Apa kabar?')
  })
})

describe('pertanyaanValid', () => {
  it('menerima pertanyaan wajar', () => {
    expect(pertanyaanValid('Apa mimpimu?')).toBe(true)
  })

  it('menolak yang kosong', () => {
    expect(pertanyaanValid('   ')).toBe(false)
  })

  it('menolak yang lebih dari 200 karakter', () => {
    expect(pertanyaanValid(`${'a'.repeat(200)}?`)).toBe(false)
  })

  // Batas atasnya harus sama persis dengan batas di sisip_pertanyaan. Kalau
  // salah satunya bergeser, orang mengetik pertanyaan yang lolos di browser
  // lalu ditolak database — galat yang muncul entah dari mana.
  it('menerima yang tepat 200 karakter', () => {
    expect(pertanyaanValid('a'.repeat(PANJANG_SISIPAN_MAKS))).toBe(true)
  })

  it('menghitung panjang setelah dirapikan, bukan sebelumnya', () => {
    expect(pertanyaanValid(`  ${'a'.repeat(PANJANG_SISIPAN_MAKS)}  `)).toBe(true)
  })
})

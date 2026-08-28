import { describe, expect, it } from 'vitest'
import { namaValid, rapikanNama } from '@/lib/nama'

describe('rapikanNama', () => {
  it('membuang spasi di ujung dan merapatkan spasi ganda', () => {
    expect(rapikanNama('  Juan   Verron ')).toBe('Juan Verron')
  })
})

describe('namaValid', () => {
  it('menerima nama wajar', () => {
    expect(namaValid('Juan')).toBe(true)
  })

  it('menolak nama kosong', () => {
    expect(namaValid('   ')).toBe(false)
  })

  it('menolak nama lebih dari 20 karakter', () => {
    expect(namaValid('a'.repeat(21))).toBe(false)
  })
})

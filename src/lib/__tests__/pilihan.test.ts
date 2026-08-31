import { describe, expect, it } from 'vitest'
import { alihkan, keadaanCentang } from '@/lib/pilihan'

describe('keadaanCentang', () => {
  it('kosong saat tidak ada yang terpilih', () => {
    expect(keadaanCentang(['a', 'b'], new Set())).toBe('kosong')
  })

  it('sebagian saat baru sebagian terpilih', () => {
    expect(keadaanCentang(['a', 'b'], new Set(['a']))).toBe('sebagian')
  })

  it('penuh saat semuanya terpilih', () => {
    expect(keadaanCentang(['a', 'b'], new Set(['a', 'b']))).toBe('penuh')
  })

  it('kosong untuk kelompok tanpa isi', () => {
    expect(keadaanCentang([], new Set(['a']))).toBe('kosong')
  })
})

describe('alihkan', () => {
  it('menambah semuanya saat sebelumnya kosong', () => {
    expect([...alihkan(['a', 'b'], new Set())].sort()).toEqual(['a', 'b'])
  })

  // Keputusan perilaku, bukan detail: menekan tema yang setengah tercentang
  // menambah sisanya. Kebalikannya akan menghapus pilihan satuan yang sudah
  // susah payah dibuat orang, hanya karena satu ketukan.
  it('menambah sisanya saat baru sebagian terpilih', () => {
    expect([...alihkan(['a', 'b'], new Set(['a']))].sort()).toEqual(['a', 'b'])
  })

  it('membuang semuanya saat sudah penuh', () => {
    expect([...alihkan(['a', 'b'], new Set(['a', 'b']))]).toEqual([])
  })

  it('tidak mengubah pilihan di luar kelompoknya', () => {
    expect([...alihkan(['a'], new Set(['a', 'z']))]).toEqual(['z'])
  })

  it('mengembalikan himpunan baru, tidak mengubah yang lama', () => {
    const semula = new Set(['a'])
    alihkan(['b'], semula)
    expect([...semula]).toEqual(['a'])
  })
})

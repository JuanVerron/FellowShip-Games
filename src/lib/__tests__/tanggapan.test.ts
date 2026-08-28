import { describe, expect, it } from 'vitest'
import { ALASAN_UMUM, alasanPublik } from '@/lib/tanggapan'

const PESAN_BOCOR =
  'permission denied for table room_peserta (hint: periksa kolom host_token)'

describe('alasanPublik', () => {
  it('menyembunyikan pesan mentah database di produksi', () => {
    expect(alasanPublik(PESAN_BOCOR, { produksi: true })).toBe(ALASAN_UMUM)
  })

  it('tidak pernah membocorkan nama tabel atau kolom di produksi', () => {
    const keluar = alasanPublik(PESAN_BOCOR, { produksi: true })
    expect(keluar).not.toContain('room_peserta')
    expect(keluar).not.toContain('host_token')
  })

  it('meneruskan pesan apa adanya di luar produksi supaya bisa didiagnosis', () => {
    expect(alasanPublik(PESAN_BOCOR, { produksi: false })).toBe(PESAN_BOCOR)
  })

  it('meneruskan galat konfigurasi kita sendiri walau di produksi', () => {
    const konfigurasi =
      'NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY wajib diisi'
    expect(alasanPublik(konfigurasi, { produksi: true })).toBe(konfigurasi)
  })
})

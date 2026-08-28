import { describe, expect, it } from 'vitest'
import { otorisasiCron } from '@/lib/cron'

describe('otorisasiCron', () => {
  it('menolak saat CRON_SECRET belum diatur, walau header terlihat benar', () => {
    expect(otorisasiCron('Bearer apa-saja', undefined)).toEqual({
      boleh: false,
      alasan: 'CRON_SECRET belum diatur',
    })
  })

  it('menolak saat CRON_SECRET diatur tapi kosong', () => {
    expect(otorisasiCron('Bearer ', '')).toEqual({
      boleh: false,
      alasan: 'CRON_SECRET belum diatur',
    })
  })

  it('menolak "Bearer undefined" saat rahasianya memang tidak ada', () => {
    expect(otorisasiCron('Bearer undefined', undefined).boleh).toBe(false)
  })

  it('menolak saat header tidak dikirim', () => {
    expect(otorisasiCron(null, 'rahasia-yang-panjang-sekali')).toEqual({
      boleh: false,
      alasan: 'header Authorization tidak cocok',
    })
  })

  it('menolak saat isinya benar tapi tanpa awalan Bearer', () => {
    expect(otorisasiCron('rahasia-yang-panjang-sekali', 'rahasia-yang-panjang-sekali').boleh).toBe(
      false,
    )
  })

  it('menolak saat rahasianya salah', () => {
    expect(otorisasiCron('Bearer rahasia-yang-keliru', 'rahasia-yang-panjang-sekali')).toEqual({
      boleh: false,
      alasan: 'header Authorization tidak cocok',
    })
  })

  it('menolak rahasia salah yang panjangnya berbeda tanpa melempar galat', () => {
    expect(otorisasiCron('Bearer x', 'rahasia-yang-panjang-sekali').boleh).toBe(false)
  })

  it('menerima saat rahasianya cocok persis', () => {
    expect(otorisasiCron('Bearer rahasia-yang-panjang-sekali', 'rahasia-yang-panjang-sekali')).toEqual(
      { boleh: true },
    )
  })
})

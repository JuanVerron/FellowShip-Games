import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { cekKesehatan } from '@/lib/health'

function klienPalsu(hasil: { data: unknown; error: unknown }): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => hasil,
        }),
      }),
    }),
  } as unknown as SupabaseClient
}

describe('cekKesehatan', () => {
  it('melaporkan sehat saat barisnya ditemukan', async () => {
    const klien = klienPalsu({
      data: { disentuh_pada: '2026-08-28T02:00:00.000Z' },
      error: null,
    })

    expect(await cekKesehatan(klien)).toEqual({
      sehat: true,
      disentuhPada: '2026-08-28T02:00:00.000Z',
    })
  })

  it('melaporkan tidak sehat dan meneruskan pesan saat database gagal', async () => {
    const klien = klienPalsu({ data: null, error: { message: 'koneksi gagal' } })

    expect(await cekKesehatan(klien)).toEqual({
      sehat: false,
      alasan: 'koneksi gagal',
    })
  })

  it('melaporkan tidak sehat saat barisnya tidak ada', async () => {
    const klien = klienPalsu({ data: null, error: null })

    expect(await cekKesehatan(klien)).toEqual({
      sehat: false,
      alasan: 'app_health row not found',
    })
  })
})

import { NextResponse } from 'next/server'
import { otorisasiCron } from '@/lib/cron'
import { buatKlienSupabase } from '@/lib/supabase'
import { alasanPublik } from '@/lib/tanggapan'

export const dynamic = 'force-dynamic'

const produksi = process.env.NODE_ENV === 'production'

export async function GET(permintaan: Request) {
  const izin = otorisasiCron(
    permintaan.headers.get('authorization'),
    process.env.CRON_SECRET,
  )

  if (!izin.boleh) {
    // Alasannya sengaja hanya masuk log, tidak ikut ke tanggapan: yang mengetuk
    // tanpa izin tidak perlu diberi tahu apa yang kurang dari ketukannya.
    console.error('[keep-alive] ditolak:', izin.alasan)
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  try {
    const { data, error } = await buatKlienSupabase().rpc('sentuh_kesehatan')

    if (error) {
      console.error('[keep-alive] gagal menulis:', error.message)
      return NextResponse.json(
        { ok: false, alasan: alasanPublik(error.message, { produksi }) },
        { status: 503 },
      )
    }

    return NextResponse.json({ ok: true, disentuhPada: data })
  } catch (galat) {
    const alasan = galat instanceof Error ? galat.message : 'galat tidak dikenal'
    console.error('[keep-alive] galat:', galat)
    return NextResponse.json(
      { ok: false, alasan: alasanPublik(alasan, { produksi }) },
      { status: 503 },
    )
  }
}

import { NextResponse } from 'next/server'
import { cekKesehatan } from '@/lib/health'
import { buatKlienSupabase } from '@/lib/supabase'
import { alasanPublik } from '@/lib/tanggapan'

export const dynamic = 'force-dynamic'

const produksi = process.env.NODE_ENV === 'production'

export async function GET() {
  try {
    const hasil = await cekKesehatan(buatKlienSupabase())

    if (hasil.sehat) {
      return NextResponse.json(hasil, { status: 200 })
    }

    console.error('[health] tidak sehat:', hasil.alasan)
    return NextResponse.json(
      { sehat: false, alasan: alasanPublik(hasil.alasan, { produksi }) },
      { status: 503 },
    )
  } catch (galat) {
    const alasan = galat instanceof Error ? galat.message : 'galat tidak dikenal'
    console.error('[health] galat:', galat)
    return NextResponse.json(
      { sehat: false, alasan: alasanPublik(alasan, { produksi }) },
      { status: 503 },
    )
  }
}

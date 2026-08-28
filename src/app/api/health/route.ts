import { NextResponse } from 'next/server'
import { cekKesehatan } from '@/lib/health'
import { buatKlienSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const hasil = await cekKesehatan(buatKlienSupabase())
    return NextResponse.json(hasil, { status: hasil.sehat ? 200 : 503 })
  } catch (galat) {
    const alasan = galat instanceof Error ? galat.message : 'galat tidak dikenal'
    return NextResponse.json({ sehat: false, alasan }, { status: 503 })
  }
}

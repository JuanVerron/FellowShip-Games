import { NextResponse } from 'next/server'
import { buatKlienSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await buatKlienSupabase().rpc('sentuh_kesehatan')

    if (error) {
      return NextResponse.json({ ok: false, alasan: error.message }, { status: 503 })
    }

    return NextResponse.json({ ok: true, disentuhPada: data })
  } catch (galat) {
    const alasan = galat instanceof Error ? galat.message : 'galat tidak dikenal'
    return NextResponse.json({ ok: false, alasan }, { status: 503 })
  }
}

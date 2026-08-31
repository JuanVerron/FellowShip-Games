// Verifikasi Potongan 5 Task 3 lewat jalur yang sama persis dengan browser:
// anon key dan RPC. Menutup opsi buang-terpakai dan kolam yang habis.
//
// Yang dibuktikan di sini dan tidak bisa dibuktikan oleh uji unit: kolam yang
// habis MENUTUP sesi dan mengembalikan nol baris, bukan melempar galat. Kalau
// ia melempar, exception membatalkan penutupan sesinya sendiri.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const baris of readFileSync('.env.local', 'utf8').split('\n')) {
  const cocok = baris.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
  if (cocok && !process.env[cocok[1]]) process.env[cocok[1]] = cocok[2].trim()
}

const klien = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )

let lulus = 0
let gagal = 0
function periksa(nama, benar, catatan = '') {
  const label = catatan ? `${nama} — ${catatan}` : nama
  if (benar) {
    lulus += 1
    console.log(`  OK    ${label}`)
  } else {
    gagal += 1
    console.log(`  GAGAL ${label}`)
  }
}

async function buatRoom(pertanyaan, buangTerpakai) {
  const { data, error } = await klien().rpc('buat_room', {
    p_nama_host: 'Juan',
    p_pertanyaan: pertanyaan,
    p_buang_terpakai: buangTerpakai,
    p_izinkan_join_telat: true,
  })
  if (error) throw new Error(error.message)
  return data[0]
}

console.log('\nKolam menyusut dan sesi tertutup saat habis')
{
  const room = await buatRoom(
    [
      { teks: 'One?', sumber: 'custom' },
      { teks: 'Two?', sumber: 'bank', bankId: 'spiritual-faith-01' },
    ],
    true,
  )
  const c = klien()
  await c.rpc('mulai_sesi', { p_kode: room.kode, p_host_token: room.host_token })

  const keluar = []
  for (let putaran = 0; putaran < 3; putaran += 1) {
    const { data, error } = await c.rpc('putar_roda', {
      p_kode: room.kode,
      p_token: room.participant_token,
      p_host_token: room.host_token,
    })
    if (putaran < 2) {
      periksa(`putaran ${putaran + 1} memberi satu pertanyaan`,
        !error && data.length === 1, error?.message ?? '')
      if (data?.[0]) keluar.push(data[0].teks)
      await c.rpc('giliran_berikutnya', {
        p_kode: room.kode,
        p_host_token: room.host_token,
      })
    } else {
      periksa('putaran ketiga mengembalikan nol baris, bukan galat',
        !error && data.length === 0, error?.message ?? `${data?.length} baris`)
    }
  }

  periksa('kedua pertanyaan berbeda, tidak ada yang keluar dua kali',
    keluar.length === 2 && keluar[0] !== keluar[1], keluar.join(' / '))

  const { data: room2 } = await c
    .from('rooms').select('status').eq('kode', room.kode).single()
  periksa('sesi berpindah ke status selesai', room2?.status === 'selesai',
    `status: ${room2?.status}`)

  const { data: kolom } = await c
    .from('room_questions').select('sumber, bank_question_id')
    .eq('room_id', room.room_id).eq('sumber', 'bank')
  periksa('asal-usul bank ikut tersimpan',
    kolom?.length === 1 && kolom[0].bank_question_id === 'spiritual-faith-01',
    JSON.stringify(kolom))
}

console.log('\nDengan opsi buang-terpakai mati, kolam tidak pernah habis')
{
  const room = await buatRoom([{ teks: 'Only?', sumber: 'custom' }], false)
  const c = klien()
  await c.rpc('mulai_sesi', { p_kode: room.kode, p_host_token: room.host_token })

  for (let putaran = 0; putaran < 2; putaran += 1) {
    const { data, error } = await c.rpc('putar_roda', {
      p_kode: room.kode,
      p_token: room.participant_token,
      p_host_token: room.host_token,
    })
    periksa(`putaran ${putaran + 1} tetap memberi pertanyaan yang sama`,
      !error && data.length === 1, error?.message ?? '')
    await c.rpc('giliran_berikutnya', {
      p_kode: room.kode,
      p_host_token: room.host_token,
    })
  }

  const { data: room2 } = await c
    .from('rooms').select('status').eq('kode', room.kode).single()
  periksa('sesi tetap berjalan', room2?.status === 'berjalan',
    `status: ${room2?.status}`)
}

console.log('\nRoom tanpa pertanyaan ditolak')
{
  const { error } = await klien().rpc('buat_room', {
    p_nama_host: 'Juan',
    p_pertanyaan: [],
    p_buang_terpakai: true,
    p_izinkan_join_telat: true,
  })
  periksa('galat berbahasa Inggris',
    error?.message === 'A room needs at least one question.',
    error?.message ?? 'tidak ada galat')
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal === 0 ? 0 : 1)

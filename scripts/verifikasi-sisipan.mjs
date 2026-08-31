// Verifikasi Potongan 6 Task 1 lewat anon key dan RPC, jalur yang sama persis
// dengan browser.
//
// Yang paling penting dibuktikan di sini: peserta biasa tidak punya jalan
// menyisipkan pertanyaan, bahkan lewat pemanggilan langsung ke database.
// Kotak sisipan yang cuma disembunyikan di browser bukan penjagaan.
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

const c = klien()
const { data: dibuat, error: galatBuat } = await c.rpc('buat_room', {
  p_nama_host: 'Juan',
  p_pertanyaan: [{ teks: 'First?', sumber: 'custom' }],
  p_buang_terpakai: true,
  p_izinkan_join_telat: true,
})
if (galatBuat) throw new Error(galatBuat.message)
const room = dibuat[0]

const { data: tamu } = await c.rpc('masuk_room', {
  p_kode: room.kode,
  p_nama: 'Tamu',
})

console.log('\nHost boleh menyisipkan')
{
  const { data, error } = await c.rpc('sisip_pertanyaan', {
    p_kode: room.kode,
    p_host_token: room.host_token,
    p_teks: 'A question out of nowhere?',
  })
  periksa('mengembalikan uuid', !error && typeof data === 'string',
    error?.message ?? String(data))

  const { data: kolam } = await c
    .from('room_questions').select('teks, urutan, sudah_keluar')
    .eq('room_id', room.room_id).order('urutan')
  periksa('masuk kolam di ekor dengan sudah_keluar = false',
    kolam?.length === 2 && kolam[1].urutan === 1 && kolam[1].sudah_keluar === false,
    JSON.stringify(kolam))
}

console.log('\nPeserta biasa ditolak database, bukan cuma browser')
{
  const { error } = await c.rpc('sisip_pertanyaan', {
    p_kode: room.kode,
    p_host_token: tamu?.[0]?.participant_token ?? 'token-ngawur',
    p_teks: 'Should be rejected?',
  })
  periksa('galat berbahasa Inggris',
    error?.message === 'Only the host can add a question.',
    error?.message ?? 'tidak ada galat')
}

console.log('\nValidasi teks')
{
  const kosong = await c.rpc('sisip_pertanyaan', {
    p_kode: room.kode, p_host_token: room.host_token, p_teks: '   ',
  })
  periksa('teks kosong ditolak',
    kosong.error?.message === 'A question needs some text.',
    kosong.error?.message ?? 'tidak ada galat')

  const panjang = await c.rpc('sisip_pertanyaan', {
    p_kode: room.kode, p_host_token: room.host_token, p_teks: 'a'.repeat(201),
  })
  periksa('teks lebih dari 200 karakter ditolak',
    panjang.error?.message === 'That question is too long, 200 characters max.',
    panjang.error?.message ?? 'tidak ada galat')
}

console.log('\nRoom yang sudah selesai menolak sisipan')
{
  await c.rpc('mulai_sesi', { p_kode: room.kode, p_host_token: room.host_token })
  for (let i = 0; i < 3; i += 1) {
    await c.rpc('putar_roda', {
      p_kode: room.kode,
      p_token: room.participant_token,
      p_host_token: room.host_token,
    })
    await c.rpc('giliran_berikutnya', {
      p_kode: room.kode, p_host_token: room.host_token,
    })
  }
  const { data: selesai } = await c
    .from('rooms').select('status').eq('kode', room.kode).single()
  periksa('kolam habis menutup sesi', selesai?.status === 'selesai',
    `status: ${selesai?.status}`)

  const { error } = await c.rpc('sisip_pertanyaan', {
    p_kode: room.kode, p_host_token: room.host_token, p_teks: 'Too late?',
  })
  periksa('sisipan setelah sesi selesai ditolak',
    error?.message === 'This session has already finished.',
    error?.message ?? 'tidak ada galat')
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal === 0 ? 0 : 1)

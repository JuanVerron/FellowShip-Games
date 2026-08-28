// Menyiapkan satu room berisi beberapa orang lewat jalur anon, lalu mencetak
// identitas masing-masing dalam bentuk yang siap ditaruh di localStorage.
//
// Dipakai untuk menguji layar sesi dari beberapa "HP" sekaligus. Identitas
// hidup di localStorage yang dibagi semua tab dengan asal yang sama, jadi dua
// orang berbeda menuntut dua asal berbeda — dan menyuntikkan identitas jauh
// lebih tahan banting daripada mengetik di formulir lewat otomasi.
//
// Pakai: node scripts/siapkan-room-uji.mjs Juan Budi Citra
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const baris of readFileSync('.env.local', 'utf8').split('\n')) {
  const cocok = baris.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
  if (cocok && !process.env[cocok[1]]) process.env[cocok[1]] = cocok[2].trim()
}

// Disalin dari src/data/contoh-pertanyaan.ts. Tidak diimpor karena Node tidak
// membaca TypeScript tanpa bendera tambahan, dan skrip ini harus bisa dijalankan
// apa adanya. Isinya cuma bahan uji; kalau bergeser sedikit, tidak ada yang rusak.
const PERTANYAAN = [
  'What small thing made you happy this week?',
  'When did you last laugh until it hurt?',
  'Who has shaped your life the most, and how?',
  'What are you most afraid of in the year ahead?',
  'Which habit do you really want to drop?',
  'What do you find yourself praying for again and again?',
  'What is the most embarrassing thing you have ever done?',
  'If you could redo one decision, which one would it be?',
]

const klien = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )

const [namaHost, ...namaLain] = process.argv.slice(2)
if (!namaHost) {
  console.error('Pakai: node scripts/siapkan-room-uji.mjs <host> [nama lain...]')
  process.exit(1)
}

const { data: dibuat, error } = await klien()
  .rpc('buat_room', { p_nama_host: namaHost, p_pertanyaan: PERTANYAAN })
  .single()
if (error) {
  console.error(error.message)
  process.exit(1)
}

const identitas = {
  [namaHost]: {
    roomId: dibuat.room_id,
    participantId: dibuat.participant_id,
    token: dibuat.participant_token,
    nama: namaHost,
    hostToken: dibuat.host_token,
  },
}

for (const nama of namaLain) {
  const { data, error: e } = await klien()
    .rpc('masuk_room', { p_kode: dibuat.kode, p_nama: nama })
    .single()
  if (e) {
    console.error(`${nama}: ${e.message}`)
    process.exit(1)
  }
  identitas[nama] = {
    roomId: data.room_id,
    participantId: data.participant_id,
    token: data.participant_token,
    nama,
    hostToken: null,
  }
}

console.log(JSON.stringify({ kode: dibuat.kode, identitas }))

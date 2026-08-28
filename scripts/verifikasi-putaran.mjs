// Verifikasi Potongan 3 lewat jalur yang sama persis dengan browser: anon key,
// RPC, dan langganan Realtime. Bukan pengganti uji di HP sungguhan, tapi cukup
// untuk membuktikan sinkronisasi dan kunci anti dua putaran bekerja.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { jalankanSql } from './sql.mjs'

for (const baris of readFileSync('.env.local', 'utf8').split('\n')) {
  const cocok = baris.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
  if (cocok && !process.env[cocok[1]]) process.env[cocok[1]] = cocok[2].trim()
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KUNCI = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const klien = () => createClient(URL, KUNCI)

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

let lulus = 0
let gagal = 0
function periksa(nama, benar, catatan = '') {
  if (benar) { lulus += 1; console.log(`  OK   ${nama}${catatan && ' — ' + catatan}`) }
  else { gagal += 1; console.log(`  GAGAL ${nama}${catatan && ' — ' + catatan}`) }
}

async function main() {
  const a = klien()

  // --- Layar 1: host membuat room ---
  const { data: dibuat, error: galatBuat } = await a
    .rpc('buat_room', { p_nama_host: 'Juan', p_pertanyaan: PERTANYAAN })
    .single()
  if (galatBuat) throw new Error(`buat_room: ${galatBuat.message}`)
  const { kode, participant_token: tokenHost, room_id: roomId } = dibuat
  console.log(`\nRoom ${kode} (${roomId})`)

  const { data: kolam } = await a
    .from('room_questions').select('id, teks, urutan')
    .eq('room_id', roomId).order('urutan')
  periksa('kolam terisi 8 pertanyaan', kolam.length === 8, `${kolam.length} baris`)

  // --- Layar 2: peserta kedua masuk ---
  const b = klien()
  const { data: masuk, error: galatMasuk } = await b
    .rpc('masuk_room', { p_kode: kode, p_nama: 'Budi' }).single()
  if (galatMasuk) throw new Error(`masuk_room: ${galatMasuk.message}`)
  const tokenBudi = masuk.participant_token

  // --- Layar 2 menyimak spins lewat Realtime ---
  const siaran = []
  const saluran = b.channel(`uji:${kode}`)
  saluran.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'spins' },
    (pesan) => { if (pesan.new.room_id === roomId) siaran.push(pesan.new) },
  )
  await new Promise((selesai, tolak) => {
    const jam = setTimeout(() => tolak(new Error('Realtime tidak SUBSCRIBED dalam 15 detik')), 15000)
    saluran.subscribe((status) => {
      if (status === 'SUBSCRIBED') { clearTimeout(jam); selesai() }
      if (status === 'CHANNEL_ERROR') { clearTimeout(jam); tolak(new Error('CHANNEL_ERROR')) }
    })
  })
  console.log('Layar 2 tersambung ke Realtime')

  // --- Layar 1 memutar ---
  const mulai = Date.now()
  const { data: putaran, error: galatPutar } = await a
    .rpc('putar_roda', { p_kode: kode, p_token: tokenHost }).single()
  if (galatPutar) throw new Error(`putar_roda: ${galatPutar.message}`)
  periksa('putaran pertama bernomor giliran 0', putaran.nomor_giliran === 0)
  periksa('teks putaran ada di kolam', kolam.some((q) => q.id === putaran.room_question_id && q.teks === putaran.teks))

  // --- Siaran sampai di layar 2 ---
  await new Promise((selesai) => {
    const jam = setInterval(() => {
      if (siaran.length > 0 || Date.now() - mulai > 15000) { clearInterval(jam); selesai() }
    }, 100)
  })
  periksa('siaran INSERT spins sampai di layar 2', siaran.length === 1, `${Date.now() - mulai} ms`)
  if (siaran.length === 1) {
    periksa('siaran membawa pertanyaan dan benih yang sama',
      siaran[0].room_question_id === putaran.room_question_id &&
      siaran[0].benih_animasi === putaran.benih_animasi)
  }

  // --- Layar 2 memuat ulang: apa yang dibaca sama dengan layar 1 ---
  const bacaTerakhir = async (k) => {
    const { data } = await k.from('spins')
      .select('room_question_id, nomor_giliran, benih_animasi, room_questions(teks)')
      .eq('room_id', roomId).order('nomor_giliran', { ascending: false })
      .limit(1).maybeSingle()
    return data
  }
  const dariA = await bacaTerakhir(a)
  const dariB = await bacaTerakhir(klien())
  periksa('muat ulang mengembalikan putaran yang sama di kedua layar',
    JSON.stringify(dariA) === JSON.stringify(dariB) &&
    dariA.room_question_id === putaran.room_question_id &&
    dariA.benih_animasi === putaran.benih_animasi,
    `benih ${dariA.benih_animasi}`)

  // --- Dua penekanan hampir bersamaan ---
  const hasil = await Promise.allSettled([
    a.rpc('putar_roda', { p_kode: kode, p_token: tokenHost }).single(),
    b.rpc('putar_roda', { p_kode: kode, p_token: tokenBudi }).single(),
    klien().rpc('putar_roda', { p_kode: kode, p_token: tokenBudi }).single(),
  ])
  const tanggapan = hasil.map((h) => h.value)
  const berhasil = tanggapan.filter((t) => !t.error)
  const ditolak = tanggapan.filter((t) => t.error)
  const nomor = berhasil.map((t) => t.data.nomor_giliran)
  periksa('tiga penekanan bersamaan tidak pernah berbagi nomor giliran',
    new Set(nomor).size === nomor.length, `nomor: [${nomor}]`)
  periksa('yang kalah dapat kalimat yang bisa dibaca, bukan galat mentah',
    ditolak.length === 0 || ditolak.every((t) => !/duplicate key|constraint/i.test(t.error.message)),
    ditolak.length ? ditolak.map((t) => `"${t.error.message}"`).join(' | ') : 'semua lolos, tidak ada yang bertabrakan')

  // --- Satu baris spins per nomor giliran ---
  const { data: semuaSpin } = await klien().from('spins')
    .select('nomor_giliran').eq('room_id', roomId)
  const nomorTersimpan = semuaSpin.map((s) => s.nomor_giliran)
  periksa('tabel spins tidak punya nomor giliran kembar',
    new Set(nomorTersimpan).size === nomorTersimpan.length, `[${nomorTersimpan.sort((x, y) => x - y)}]`)

  // --- Tabrakan yang dipaksa ---
  // Tiga penekanan di atas ternyata selalu berbaris rapi: PostgREST menyelesaikan
  // satu permintaan sebelum yang berikutnya membaca nomor giliran, jadi masing-
  // masing dapat nomornya sendiri. Bagus untuk peserta, tapi tidak membuktikan
  // apa-apa soal kuncinya. Tabrakannya dipaksa: nomor giliran dikembalikan ke
  // angka yang sudah terpakai, lalu roda diputar lagi lewat jalur anon yang sama
  // dengan browser.
  await jalankanSql(
    `update public.rooms set nomor_giliran_sekarang = 0 where id = '${roomId}'`,
  )
  const { error: galatTabrakan } = await klien()
    .rpc('putar_roda', { p_kode: kode, p_token: tokenHost }).single()
  periksa('nomor giliran yang sudah terpakai ditolak',
    galatTabrakan?.message === 'Someone else just spun. Here comes their question.',
    galatTabrakan?.message ?? 'tidak ditolak')
  periksa('penolakannya datang dari batasan unik di database',
    (await jalankanSql(
      `select conname from pg_constraint where conrelid = 'public.spins'::regclass and contype = 'u'`,
    ))[0]?.conname === 'spins_room_id_nomor_giliran_key')

  // --- Token ngawur ---
  const { error: galatToken } = await klien()
    .rpc('putar_roda', { p_kode: kode, p_token: 'token-ngawur' }).single()
  periksa('token ngawur ditolak', galatToken?.message === 'You are not in this room.',
    galatToken?.message ?? 'tidak ditolak')

  await b.removeChannel(saluran)
  console.log(`\n${lulus} lulus, ${gagal} gagal\n`)
  process.exit(gagal === 0 ? 0 : 1)
}

main().catch((e) => { console.error('\nMELEDAK:', e.message); process.exit(1) })

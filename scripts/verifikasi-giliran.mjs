// Verifikasi Potongan 4 lewat jalur yang sama persis dengan browser: anon key
// dan RPC. Menutup seluruh alur giliran, dari Mulai sampai pendatang telat.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { jalankanSql } from './sql.mjs'

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

const PERTANYAAN = ['A?', 'B?', 'C?', 'D?', 'E?', 'F?', 'G?', 'H?']

async function urutanAntrean(roomId) {
  const { data } = await klien()
    .from('participants')
    .select('nama, urutan_giliran')
    .eq('room_id', roomId)
    .order('urutan_giliran', { ascending: true, nullsFirst: false })
  return data
}

async function main() {
  const a = klien()

  const { data: dibuat, error: e1 } = await a
    .rpc('buat_room', { p_nama_host: 'Juan', p_pertanyaan: PERTANYAAN })
    .single()
  if (e1) throw new Error(`buat_room: ${e1.message}`)
  const { kode, room_id: roomId, host_token: hostToken } = dibuat
  const tokenJuan = dibuat.participant_token
  console.log(`\nRoom ${kode}`)

  const masuk = {}
  for (const nama of ['Budi', 'Citra']) {
    const { data, error } = await klien()
      .rpc('masuk_room', { p_kode: kode, p_nama: nama })
      .single()
    if (error) throw new Error(`masuk_room ${nama}: ${error.message}`)
    masuk[nama] = data.participant_token
  }

  // --- Sebelum Mulai, roda terkunci ---
  const { error: eBelumMulai } = await klien()
    .rpc('putar_roda', { p_kode: kode, p_token: tokenJuan, p_host_token: hostToken })
    .single()
  periksa(
    'roda terkunci sebelum sesi dimulai',
    eBelumMulai?.message === 'This session has not started yet.',
    eBelumMulai?.message ?? 'tidak ditolak',
  )

  // --- Hanya host yang boleh memulai ---
  const { error: eBukanHost } = await klien().rpc('mulai_sesi', {
    p_kode: kode,
    p_host_token: 'bukan-host',
  })
  periksa(
    'peserta biasa tidak boleh memulai sesi',
    eBukanHost?.message === 'Only the host can start the session.',
    eBukanHost?.message ?? 'tidak ditolak',
  )

  // --- Host memulai ---
  const { error: eMulai } = await a.rpc('mulai_sesi', {
    p_kode: kode,
    p_host_token: hostToken,
  })
  if (eMulai) throw new Error(`mulai_sesi: ${eMulai.message}`)

  const antrean = await urutanAntrean(roomId)
  periksa(
    'ketiga peserta dapat urutan giliran 0, 1, 2',
    JSON.stringify(antrean.map((o) => o.urutan_giliran)) === '[0,1,2]',
    JSON.stringify(antrean),
  )

  const { data: roomBerjalan } = await klien()
    .from('rooms').select('status, nomor_giliran_sekarang').eq('id', roomId).single()
  periksa(
    'status room jadi berjalan di giliran 0',
    roomBerjalan.status === 'berjalan' && roomBerjalan.nomor_giliran_sekarang === 0,
    JSON.stringify(roomBerjalan),
  )

  periksa(
    'sesi tidak bisa dimulai dua kali',
    (await klien().rpc('mulai_sesi', { p_kode: kode, p_host_token: hostToken }))
      .error?.message === 'This session has already started.',
  )

  // --- Penguncian giliran ---
  const semuaToken = { Juan: tokenJuan, ...masuk }
  const pemilik0 = antrean[0].nama
  const bukanPemilik = antrean.find((o) => o.nama !== pemilik0 && o.nama !== 'Juan')

  const { error: eBukanGiliran } = await klien()
    .rpc('putar_roda', {
      p_kode: kode,
      p_token: semuaToken[bukanPemilik.nama],
      p_host_token: null,
    })
    .single()
  periksa(
    'peserta yang bukan pemilik giliran ditolak',
    eBukanGiliran?.message === 'It is not your turn yet.',
    `${bukanPemilik.nama} mencoba di giliran ${pemilik0} — ${eBukanGiliran?.message ?? 'tidak ditolak'}`,
  )

  // --- Host memutar mewakili ---
  const { data: putaran0, error: ePutar } = await a
    .rpc('putar_roda', { p_kode: kode, p_token: tokenJuan, p_host_token: hostToken })
    .single()
  periksa(
    'host boleh memutar walau bukan gilirannya',
    !ePutar && putaran0?.nomor_giliran === 0,
    ePutar?.message ?? `giliran ${putaran0?.nomor_giliran}`,
  )

  const [{ nama: tercatat }] = await jalankanSql(
    `select p.nama from public.spins s
       join public.participants p on p.id = s.participant_id
      where s.room_id = '${roomId}' order by s.nomor_giliran desc limit 1`,
  )
  periksa(
    'putaran dicatat atas nama pemilik giliran, bukan host',
    tercatat === pemilik0,
    `tercatat ${tercatat}, pemilik ${pemilik0}`,
  )

  // --- Roda tidak memindah giliran sendiri ---
  const { data: setelahPutar } = await klien()
    .from('rooms').select('nomor_giliran_sekarang').eq('id', roomId).single()
  periksa(
    'memutar roda tidak memindah giliran',
    setelahPutar.nomor_giliran_sekarang === 0,
    `nomor giliran ${setelahPutar.nomor_giliran_sekarang}`,
  )

  // --- Putaran kedua di giliran yang sama ditolak ---
  const { error: eDobel } = await klien()
    .rpc('putar_roda', { p_kode: kode, p_token: tokenJuan, p_host_token: hostToken })
    .single()
  periksa(
    'giliran yang sudah punya pertanyaan tidak bisa diputar lagi',
    eDobel?.message === 'This turn already has its question.',
    eDobel?.message ?? 'tidak ditolak',
  )

  // --- Hanya host yang memindah giliran ---
  const { error: eGeserBukanHost } = await klien().rpc('giliran_berikutnya', {
    p_kode: kode,
    p_host_token: 'bukan-host',
  })
  periksa(
    'peserta biasa tidak boleh memindah giliran',
    eGeserBukanHost?.message === 'Only the host can move to the next turn.',
    eGeserBukanHost?.message ?? 'tidak ditolak',
  )

  const { data: giliranBaru, error: eGeser } = await a.rpc('giliran_berikutnya', {
    p_kode: kode,
    p_host_token: hostToken,
  })
  periksa('host memindah giliran ke 1', !eGeser && giliranBaru === 1,
    eGeser?.message ?? `giliran ${giliranBaru}`)

  // Pemilik giliran 1 sekarang boleh memutar tanpa bantuan host.
  const pemilik1 = antrean[1].nama
  const { error: ePemilik1 } = await klien()
    .rpc('putar_roda', {
      p_kode: kode,
      p_token: semuaToken[pemilik1],
      p_host_token: null,
    })
    .single()
  periksa('pemilik giliran berikutnya boleh memutar sendiri', !ePemilik1,
    ePemilik1?.message ?? `${pemilik1} memutar giliran 1`)

  // --- Pendatang telat ke ekor ---
  const { error: eDodi } = await klien()
    .rpc('masuk_room', { p_kode: kode, p_nama: 'Dodi' }).single()
  if (eDodi) throw new Error(`masuk_room Dodi: ${eDodi.message}`)
  const antreanBaru = await urutanAntrean(roomId)
  const dodi = antreanBaru.find((o) => o.nama === 'Dodi')
  periksa(
    'pendatang telat menempati posisi terakhir antrean',
    dodi.urutan_giliran === 3 &&
      dodi.urutan_giliran === Math.max(...antreanBaru.map((o) => o.urutan_giliran)),
    JSON.stringify(antreanBaru.map((o) => `${o.nama}:${o.urutan_giliran}`)),
  )

  periksa(
    'urutan tiga peserta pertama tidak bergeser karena pendatang telat',
    JSON.stringify(antreanBaru.slice(0, 3).map((o) => o.nama)) ===
      JSON.stringify(antrean.map((o) => o.nama)),
  )

  // --- Pengacakan benar-benar acak ---
  const urutanTerlihat = new Set()
  for (let i = 0; i < 6; i += 1) {
    const { data: r } = await klien()
      .rpc('buat_room', { p_nama_host: 'H', p_pertanyaan: PERTANYAAN }).single()
    for (const nama of ['P2', 'P3', 'P4']) {
      await klien().rpc('masuk_room', { p_kode: r.kode, p_nama: nama }).single()
    }
    await klien().rpc('mulai_sesi', { p_kode: r.kode, p_host_token: r.host_token })
    const urut = await urutanAntrean(r.room_id)
    urutanTerlihat.add(urut.map((o) => o.nama).join(','))
  }
  periksa(
    'urutan giliran benar-benar diacak, bukan urutan bergabung',
    urutanTerlihat.size > 1,
    `${urutanTerlihat.size} urutan berbeda dari 6 room`,
  )

  console.log(`\n${lulus} lulus, ${gagal} gagal\n`)
  process.exit(gagal === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('\nMELEDAK:', e.message)
  process.exit(1)
})

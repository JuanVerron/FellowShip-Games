// Menjalankan SQL di project Supabase lewat Management API, sebagai pengganti
// SQL Editor di dashboard. Dipakai untuk verifikasi, bukan untuk migrasi —
// migrasi tetap lewat `supabase db push`.
//
// Pakai: node scripts/sql.mjs "select 1"   atau   node scripts/sql.mjs -f berkas.sql
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

function muatEnv(berkas = '.env.local') {
  for (const baris of readFileSync(berkas, 'utf8').split('\n')) {
    const cocok = baris.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (cocok && !process.env[cocok[1]]) {
      process.env[cocok[1]] = cocok[2].replace(/^["']|["']$/g, '')
    }
  }
}

export async function jalankanSql(sql) {
  const ref = readFileSync('supabase/.temp/project-ref', 'utf8').trim()
  const tanggapan = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    },
  )
  const isi = await tanggapan.text()
  if (!tanggapan.ok) throw new Error(`${tanggapan.status} ${isi}`)
  return JSON.parse(isi)
}

muatEnv()

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = process.argv[2] === '-f'
    ? readFileSync(process.argv[3], 'utf8')
    : process.argv.slice(2).join(' ')
  jalankanSql(arg)
    .then((hasil) => console.log(JSON.stringify(hasil, null, 2)))
    .catch((e) => { console.error(e.message); process.exit(1) })
}

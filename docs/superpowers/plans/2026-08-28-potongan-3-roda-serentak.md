# Potongan 3 — Roda Berputar Serentak: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tombol putar menghasilkan satu pertanyaan yang sama di semua layar, dengan animasi roda yang berhenti di posisi yang sama, dan dua penekanan hampir bersamaan tidak pernah menghasilkan dua pertanyaan.

**Architecture:** Hasil putaran ditentukan sekali di database, bukan di browser. Batasan unik `(room_id, nomor_giliran)` pada tabel `spins` yang menjadi kunci anti dua putaran bersamaan — bukan penjagaan di kode aplikasi, yang selalu bisa kalah oleh dua permintaan yang tiba nyaris bersamaan. Sudut akhir roda dihitung dari `benih_animasi` yang ikut disiarkan, sehingga semua layar sampai di posisi yang identik.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind, `@supabase/supabase-js`, Vitest, Postgres.

**Spec:** `PRD.md` bagian 4.4, 4.5, 6 dan Build Order Potongan 3.

**Prasyarat:** Potongan 2 selesai — semua butir "Definisi Selesai Potongan 2" terpenuhi.

## Global Constraints

- Nol biaya. Package manager: pnpm. Uji: `pnpm test`.
- Seluruh antarmuka berbahasa Inggris, termasuk pesan galat yang dilempar fungsi
  database. Rencana ini ditulis sebelum aturan itu ada di `CLAUDE.md`, jadi setiap
  cuplikan kode di bawah yang masih berbahasa Indonesia sudah diperbaiki di repo.
  Potret HP 360px. Sentuh minimal 44px.
- Browser tidak menulis langsung ke tabel; semua penulisan lewat fungsi `security definer`.
- Animasi roda memakai transform CSS, bukan gambar per bingkai.
- Hormati `prefers-reduced-motion`: roda tetap memberi hasil, tapi tanpa putaran panjang.
- Satu commit per task.

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `supabase/migrations/0004_kolam_dan_putaran.sql` | Tabel `room_questions` dan `spins`, fungsi `putar_roda`, dan `buat_room` versi baru yang menerima daftar pertanyaan |
| `scripts/sql.mjs` | Menjalankan SQL sembarang di project lewat Management API, pengganti SQL Editor untuk verifikasi dari terminal |
| `src/data/contoh-pertanyaan.ts` | Delapan pertanyaan contoh. **Sementara** — dihapus di Potongan 5 saat bank sungguhan masuk |
| `src/lib/roda.ts` | Matematika sudut roda. Murni, tanpa I/O, bisa diuji tanpa DOM |
| `src/lib/putaran.ts` | Pembungkus RPC `putar_roda` dan pengambil kolam serta putaran terakhir |
| `src/components/Roda.tsx` | Menggambar roda dan menganimasikannya ke sudut yang diberikan |
| `src/hooks/useRoom.ts` | Diperluas: ikut menyimak tabel `spins`, dan menyediakan kolam serta putaran terakhir |
| `src/app/room/[kode]/page.tsx` | Diperluas: roda, tombol putar, dan tampilan pertanyaan terpilih |

---

### Task 1: Kolam pertanyaan, riwayat putaran, dan fungsi putar

**Files:**
- Create: `supabase/migrations/0004_kolam_dan_putaran.sql`
- Create: `scripts/sql.mjs`

> **Koreksi rencana (nomor migrasi).** Rencana ini menyebut `0003`, tapi nomor
> itu sudah dipakai `0003_pesan_antarmuka_inggris.sql` — migrasi yang lahir di
> luar rencana Potongan 2 saat antarmuka dipindah ke bahasa Inggris. Migrasi
> potongan ini jadi `0004`.

**Interfaces:**
- Consumes: `rooms`, `participants`, `participant_secrets` (Potongan 2)
- Produces:
  - Tabel `public.room_questions(id, room_id, sumber, bank_question_id, teks, urutan, sudah_keluar)`
  - Tabel `public.spins(id, room_id, participant_id, room_question_id, nomor_giliran, benih_animasi, dibuat_pada)` dengan `unique (room_id, nomor_giliran)`
  - `public.buat_room(p_nama_host text, p_pertanyaan text[])` — **menggantikan** versi satu argumen dari Potongan 2
  - `public.putar_roda(p_kode text, p_token text)` → `table(room_question_id uuid, teks text, nomor_giliran int, benih_animasi int)`

- [x] **Step 1: Tulis berkas migrasi**

Buat `supabase/migrations/0004_kolam_dan_putaran.sql`. Isi lengkapnya ada di
repo; tiga hal di bawah ini berbeda dari tebakan awal rencana dan sengaja
dicatat karena masing-masing lahir dari kesalahan yang nyata:

1. **`set search_path = public, extensions`, bukan `public` saja.** `pgcrypto`
   dipasang Supabase di skema `extensions`, jadi `gen_random_bytes` tidak
   terlihat kalau `extensions` tidak ikut disebut. Kedua fungsi di Potongan 2
   sudah memakai bentuk ini; rencana ini sempat menuliskan bentuk yang salah.

2. **Semua `raise exception` berbahasa Inggris.** Pesan yang dilempar fungsi
   database ikut tampil di layar peserta, jadi ia termasuk antarmuka dan
   tunduk pada aturan bahasa di `CLAUDE.md`. Ini keputusan yang sama yang
   melahirkan migrasi `0003`.

3. **Pelanggaran batasan unik ditangkap dan diganti pesan yang bisa dibaca.**
   Tanpa penangkapan itu yang sampai ke layar adalah
   `duplicate key value violates unique constraint "spins_room_id_nomor_giliran_key"`
   — betul secara teknis, tapi bukan kalimat yang pantas dibaca peserta.
   Penangkapnya tidak memindahkan penjagaan ke kode aplikasi: yang menolak
   tetap batasan unik di database, kode cuma menerjemahkan penolakannya.

Blok `alter publication` dibungkus pemeriksaan `pg_publication_tables` dan
diikuti `replica identity full`, mengikuti keadaan yang terbukti mengirim
peristiwa Realtime di Potongan 2.

- [x] **Step 2: Terapkan dan verifikasi**

Migrasi diterapkan dari baris perintah, bukan dari SQL Editor:

```bash
set -a; . ./.env.local; set +a
pnpm dlx supabase@latest db push --linked
```

Verifikasinya butuh SQL sembarang, dan `supabase db push` hanya menerapkan
migrasi. Jalan keluarnya `scripts/sql.mjs`, pembungkus tipis untuk endpoint
`POST /v1/projects/{ref}/database/query` di Management API — persis yang
dipakai SQL Editor di dashboard, tapi bisa dipanggil dari terminal:

```bash
node scripts/sql.mjs "select * from public.buat_room('Juan', array['Apa mimpimu?', 'Kapan terakhir menangis?', 'Lagu favoritmu?'])"
```

Hasil: satu baris `room_id, kode, host_token, participant_id, participant_token`,
dan `room_questions` untuk room itu berisi tiga baris `urutan` 0–2.

- [x] **Step 3: Verifikasi kunci anti dua putaran**

```bash
node scripts/sql.mjs "select * from public.putar_roda('KODE', 'TOKEN')"
node scripts/sql.mjs "update public.rooms set nomor_giliran_sekarang = 0 where kode = 'KODE'"
node scripts/sql.mjs "select * from public.putar_roda('KODE', 'TOKEN')"
```

Hasil: panggilan pertama mengembalikan satu pertanyaan dengan `nomor_giliran` 0;
panggilan terakhir gagal dengan `Someone else just spun. Here comes their
question.` Yang menolak adalah batasan uniknya — dibuktikan terpisah:

```bash
node scripts/sql.mjs "select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='public.spins'::regclass and contype='u'"
```

Hasil: `spins_room_id_nomor_giliran_key | UNIQUE (room_id, nomor_giliran)`.

- [x] **Step 4: Verifikasi token asing ditolak**

```bash
node scripts/sql.mjs "select * from public.putar_roda('KODE', 'token-ngawur')"
node scripts/sql.mjs "select * from public.putar_roda('ZZZZZ', 'token-ngawur')"
```

Hasil: `You are not in this room.` dan `Room not found.`

- [x] **Step 5: Commit**

```bash
git add supabase/migrations/0004_kolam_dan_putaran.sql scripts/sql.mjs
git commit -m "feat: kolam pertanyaan, riwayat putaran, dan fungsi putar_roda"
```

---

### Task 2: Matematika sudut roda

**Files:**
- Create: `src/lib/roda.ts`
- Test: `src/lib/__tests__/roda.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `PUTARAN_MINIMAL = 4`
  - `sudutSegmen(jumlah: number): number`
  - `sudutAkhir(indeks: number, jumlah: number, benih: number): number`

- [ ] **Step 1: Tulis uji yang gagal**

Buat `src/lib/__tests__/roda.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { sudutAkhir, sudutSegmen } from '@/lib/roda'

describe('sudutSegmen', () => {
  it('membagi lingkaran rata', () => {
    expect(sudutSegmen(4)).toBe(90)
    expect(sudutSegmen(8)).toBe(45)
  })
})

describe('sudutAkhir', () => {
  it('mendaratkan segmen pertama di penunjuk atas', () => {
    expect(sudutAkhir(0, 4, 0)).toBe(4 * 360 + 315)
  })

  it('menggeser satu segmen untuk indeks berikutnya', () => {
    expect(sudutAkhir(1, 4, 0)).toBe(4 * 360 + 225)
  })

  it('menambah jumlah putaran sesuai benih supaya tidak monoton', () => {
    expect(sudutAkhir(0, 4, 1)).toBe(5 * 360 + 315)
    expect(sudutAkhir(0, 4, 2)).toBe(6 * 360 + 315)
  })

  it('mengulang jumlah putaran setiap tiga benih', () => {
    expect(sudutAkhir(0, 4, 3)).toBe(sudutAkhir(0, 4, 0))
  })

  it('menolak kolam kosong alih-alih membagi dengan nol', () => {
    expect(() => sudutAkhir(0, 0, 0)).toThrow()
  })
})
```

Uji terakhir ada karena pembagian dengan nol di JavaScript menghasilkan `Infinity`, bukan galat — dan `Infinity` yang masuk ke `transform: rotate()` membuat roda hilang dari layar tanpa satu pun pesan galat.

- [ ] **Step 2: Jalankan uji dan pastikan gagal**

Run: `pnpm test`
Expected: GAGAL — `Cannot find module '@/lib/roda'`.

- [ ] **Step 3: Tulis implementasinya**

Buat `src/lib/roda.ts`:

```typescript
export const PUTARAN_MINIMAL = 4
export const RAGAM_PUTARAN = 3

export function sudutSegmen(jumlah: number): number {
  if (jumlah < 1) throw new Error('kolam pertanyaan kosong')
  return 360 / jumlah
}

export function sudutAkhir(
  indeks: number,
  jumlah: number,
  benih: number,
): number {
  const segmen = sudutSegmen(jumlah)
  const tengahSegmen = indeks * segmen + segmen / 2
  const putaran = PUTARAN_MINIMAL + (Math.abs(benih) % RAGAM_PUTARAN)
  return putaran * 360 + (360 - tengahSegmen)
}
```

- [ ] **Step 4: Jalankan uji dan pastikan lulus**

Run: `pnpm test`
Expected: LULUS — 7 berkas uji, 26 uji.

- [ ] **Step 5: Commit**

```bash
git add src/lib/roda.ts src/lib/__tests__/roda.test.ts
git commit -m "feat: matematika sudut roda"
```

---

### Task 3: Pembungkus putaran dan perluasan hook

**Files:**
- Create: `src/data/contoh-pertanyaan.ts`
- Create: `src/lib/putaran.ts`
- Modify: `src/hooks/useRoom.ts` (tambah kolam dan putaran terakhir)
- Modify: `src/app/buat/page.tsx` (kirim daftar pertanyaan ke `buatRoom`)
- Modify: `src/lib/room.ts` (tanda tangan `buatRoom` bertambah satu argumen)

**Interfaces:**
- Consumes: `putar_roda`, `buat_room` versi baru (Task 1)
- Produces:
  - `CONTOH_PERTANYAAN: string[]`
  - `type PertanyaanKolam = { id: string; teks: string; urutan: number; sudahKeluar: boolean }`
  - `type Putaran = { roomQuestionId: string; teks: string; nomorGiliran: number; benihAnimasi: number }`
  - `putarRoda(kode: string, token: string): Promise<Putaran>`
  - `ambilKolam(roomId: string): Promise<PertanyaanKolam[]>`
  - `ambilPutaranTerakhir(roomId: string): Promise<Putaran | null>`
  - `buatRoom(namaHost: string, pertanyaan: string[])` — tanda tangan baru
  - `useRoom(kode)` mengembalikan tambahan: `kolam: PertanyaanKolam[]`, `putaran: Putaran | null`

- [ ] **Step 1: Tulis pertanyaan contoh sementara**

Buat `src/data/contoh-pertanyaan.ts`:

```typescript
// SEMENTARA. Dihapus di Potongan 5 saat bank pertanyaan sungguhan masuk.
export const CONTOH_PERTANYAAN: string[] = [
  'Apa hal kecil yang bikin kamu senang minggu ini?',
  'Kapan terakhir kali kamu benar-benar tertawa lepas?',
  'Siapa orang yang paling berjasa di hidupmu, dan kenapa?',
  'Apa yang paling kamu takutkan setahun ke depan?',
  'Kebiasaan apa yang pengin banget kamu hentikan?',
  'Doa apa yang paling sering kamu ulang?',
  'Apa hal paling memalukan yang pernah kamu lakukan?',
  'Kalau bisa mengulang satu keputusan, yang mana?',
]
```

- [ ] **Step 2: Tulis pembungkus putaran**

Buat `src/lib/putaran.ts`:

```typescript
import { buatKlienSupabase } from '@/lib/supabase'

export type PertanyaanKolam = {
  id: string
  teks: string
  urutan: number
  sudahKeluar: boolean
}

export type Putaran = {
  roomQuestionId: string
  teks: string
  nomorGiliran: number
  benihAnimasi: number
}

export async function putarRoda(kode: string, token: string): Promise<Putaran> {
  const { data, error } = await buatKlienSupabase()
    .rpc('putar_roda', { p_kode: kode, p_token: token })
    .single()

  if (error) throw new Error(error.message)

  const hasil = data as {
    room_question_id: string
    teks: string
    nomor_giliran: number
    benih_animasi: number
  }

  return {
    roomQuestionId: hasil.room_question_id,
    teks: hasil.teks,
    nomorGiliran: hasil.nomor_giliran,
    benihAnimasi: hasil.benih_animasi,
  }
}

export async function ambilKolam(roomId: string): Promise<PertanyaanKolam[]> {
  const { data, error } = await buatKlienSupabase()
    .from('room_questions')
    .select('id, teks, urutan, sudah_keluar')
    .eq('room_id', roomId)
    .order('urutan', { ascending: true })

  if (error) throw new Error(error.message)

  return (data as { id: string; teks: string; urutan: number; sudah_keluar: boolean }[])
    .map((baris) => ({
      id: baris.id,
      teks: baris.teks,
      urutan: baris.urutan,
      sudahKeluar: baris.sudah_keluar,
    }))
}

export async function ambilPutaranTerakhir(roomId: string): Promise<Putaran | null> {
  const { data, error } = await buatKlienSupabase()
    .from('spins')
    .select('room_question_id, nomor_giliran, benih_animasi, room_questions(teks)')
    .eq('room_id', roomId)
    .order('nomor_giliran', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const baris = data as unknown as {
    room_question_id: string
    nomor_giliran: number
    benih_animasi: number
    room_questions: { teks: string } | { teks: string }[]
  }

  const pertanyaan = Array.isArray(baris.room_questions)
    ? baris.room_questions[0]
    : baris.room_questions

  return {
    roomQuestionId: baris.room_question_id,
    teks: pertanyaan?.teks ?? '',
    nomorGiliran: baris.nomor_giliran,
    benihAnimasi: baris.benih_animasi,
  }
}
```

`ambilPutaranTerakhir` inilah yang membuat layar pulih benar setelah dimuat ulang: keadaan roda tidak disimpan di memori browser, tapi selalu dibaca ulang dari putaran terakhir yang tercatat.

- [ ] **Step 3: Ubah tanda tangan `buatRoom`**

Di `src/lib/room.ts`, ganti fungsi `buatRoom` menjadi:

```typescript
export async function buatRoom(
  namaHost: string,
  pertanyaan: string[],
): Promise<{ kode: string; identitas: Identitas }> {
  const { data, error } = await buatKlienSupabase()
    .rpc('buat_room', { p_nama_host: namaHost, p_pertanyaan: pertanyaan })
    .single()

  if (error) throw new Error(error.message)

  const hasil = data as {
    room_id: string
    kode: string
    host_token: string
    participant_id: string
    participant_token: string
  }

  return {
    kode: hasil.kode,
    identitas: {
      roomId: hasil.room_id,
      participantId: hasil.participant_id,
      token: hasil.participant_token,
      nama: namaHost,
      hostToken: hasil.host_token,
    },
  }
}
```

Di `src/app/buat/page.tsx`, ubah pemanggilannya dan tambahkan impornya:

```typescript
import { CONTOH_PERTANYAAN } from '@/data/contoh-pertanyaan'
```

```typescript
const { kode, identitas } = await buatRoom(rapi, CONTOH_PERTANYAAN)
```

- [ ] **Step 4: Perluas hook**

Di `src/hooks/useRoom.ts`, ganti seluruh isi berkas:

```typescript
'use client'

import { useEffect, useState } from 'react'
import {
  ambilKolam,
  ambilPutaranTerakhir,
  type PertanyaanKolam,
  type Putaran,
} from '@/lib/putaran'
import { ambilPeserta, ambilRoom, type Peserta, type Room } from '@/lib/room'
import { buatKlienSupabase } from '@/lib/supabase'

export function useRoom(kode: string) {
  const [room, setRoom] = useState<Room | null>(null)
  const [peserta, setPeserta] = useState<Peserta[]>([])
  const [kolam, setKolam] = useState<PertanyaanKolam[]>([])
  const [putaran, setPutaran] = useState<Putaran | null>(null)
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    let dibatalkan = false
    const klien = buatKlienSupabase()

    async function muatUlang() {
      try {
        const r = await ambilRoom(kode)
        if (dibatalkan) return

        setRoom(r)
        if (!r) {
          setPeserta([])
          setKolam([])
          setPutaran(null)
          setGalat('Room tidak ditemukan')
          return
        }

        const [daftarPeserta, daftarKolam, putaranTerakhir] = await Promise.all([
          ambilPeserta(r.id),
          ambilKolam(r.id),
          ambilPutaranTerakhir(r.id),
        ])
        if (dibatalkan) return

        setPeserta(daftarPeserta)
        setKolam(daftarKolam)
        setPutaran(putaranTerakhir)
        setGalat(null)
      } catch (e) {
        if (!dibatalkan) setGalat(e instanceof Error ? e.message : 'Gagal memuat room')
      } finally {
        if (!dibatalkan) setMemuat(false)
      }
    }

    void muatUlang()

    const saluran = klien.channel(`room:${kode}`)
    for (const tabel of ['rooms', 'participants', 'room_questions', 'spins']) {
      saluran.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tabel },
        () => void muatUlang(),
      )
    }
    saluran.subscribe()

    return () => {
      dibatalkan = true
      void klien.removeChannel(saluran)
    }
  }, [kode])

  return { room, peserta, kolam, putaran, memuat, galat }
}
```

- [ ] **Step 5: Pastikan uji dan build masih bersih**

Run: `pnpm test && pnpm build`
Expected: uji LULUS 26, build tanpa galat TypeScript.

- [ ] **Step 6: Commit**

```bash
git add src/data src/lib/putaran.ts src/lib/room.ts src/hooks/useRoom.ts src/app/buat/page.tsx
git commit -m "feat: pembungkus putaran dan hook yang menyimak spins"
```

---

### Task 4: Komponen roda dan layar sesi

**Files:**
- Create: `src/components/Roda.tsx`
- Modify: `src/app/room/[kode]/page.tsx`

**Interfaces:**
- Consumes: `sudutAkhir` (Task 2); `putarRoda`, `useRoom` (Task 3); `bacaIdentitas` (Potongan 2)
- Produces: komponen `<Roda daftar={string[]} indeksTerpilih={number | null} benih={number} berputar={boolean} />`

- [ ] **Step 1: Buat komponen roda**

Buat `src/components/Roda.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { sudutAkhir, sudutSegmen } from '@/lib/roda'

const WARNA = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
]

function potong(teks: string, panjang = 16): string {
  return teks.length <= panjang ? teks : `${teks.slice(0, panjang - 1)}…`
}

export function Roda({
  daftar,
  indeksTerpilih,
  benih,
}: {
  daftar: string[]
  indeksTerpilih: number | null
  benih: number
}) {
  const [sudut, setSudut] = useState(0)

  useEffect(() => {
    if (indeksTerpilih === null || daftar.length === 0) return
    setSudut(sudutAkhir(indeksTerpilih, daftar.length, benih))
  }, [indeksTerpilih, benih, daftar.length])

  if (daftar.length === 0) {
    return <p className="text-center opacity-60">Kolam pertanyaan kosong.</p>
  }

  const segmen = sudutSegmen(daftar.length)
  const gradien = daftar
    .map((_, i) => {
      const warna = WARNA[i % WARNA.length]
      return `${warna} ${i * segmen}deg ${(i + 1) * segmen}deg`
    })
    .join(', ')

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px]">
      <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 text-3xl leading-none">
        ▼
      </div>

      <div
        className="h-full w-full rounded-full border-4 border-black/10 motion-safe:transition-transform motion-safe:duration-[4000ms] motion-safe:ease-out"
        style={{
          background: `conic-gradient(${gradien})`,
          transform: `rotate(${sudut}deg)`,
        }}
      >
        {daftar.map((teks, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 origin-left text-[10px] font-semibold text-white"
            style={{
              transform: `rotate(${i * segmen + segmen / 2}deg) translateX(24px)`,
            }}
          >
            {potong(teks)}
          </div>
        ))}
      </div>
    </div>
  )
}
```

Label di roda sengaja dipotong pendek. Pertanyaan utuh tidak mungkin terbaca di segmen roda pada layar 360px; roda tugasnya menunjukkan bahwa undiannya nyata, dan teks utuhnya tampil besar di bawah setelah berhenti. Kelas `motion-safe:` membuat animasi otomatis mati bagi orang yang menyalakan "kurangi animasi" — hasilnya tetap sampai, cuma tanpa putaran panjang.

- [ ] **Step 2: Perluas layar room**

Ganti seluruh isi `src/app/room/[kode]/page.tsx`:

```tsx
'use client'

import { use, useEffect, useState } from 'react'
import { Roda } from '@/components/Roda'
import { useRoom } from '@/hooks/useRoom'
import { bacaIdentitas, type Identitas } from '@/lib/identitas'
import { putarRoda } from '@/lib/putaran'

export default function HalamanRoom({
  params,
}: {
  params: Promise<{ kode: string }>
}) {
  const { kode: kodeMentah } = use(params)
  const kode = kodeMentah.toUpperCase()
  const { room, peserta, kolam, putaran, memuat, galat } = useRoom(kode)
  const [identitas, setIdentitas] = useState<Identitas | null>(null)
  const [memutar, setMemutar] = useState(false)
  const [galatPutar, setGalatPutar] = useState<string | null>(null)

  useEffect(() => {
    setIdentitas(bacaIdentitas(kode))
  }, [kode])

  async function putar() {
    if (!identitas) return
    setMemutar(true)
    setGalatPutar(null)
    try {
      await putarRoda(kode, identitas.token)
    } catch (e) {
      setGalatPutar(e instanceof Error ? e.message : 'Gagal memutar')
    } finally {
      setMemutar(false)
    }
  }

  if (memuat) return <main className="p-6">Memuat…</main>

  if (galat || !room) {
    return (
      <main className="mx-auto max-w-md p-6">
        <p className="text-red-600">{galat ?? 'Room tidak ditemukan'}</p>
      </main>
    )
  }

  const indeksTerpilih = putaran
    ? kolam.findIndex((p) => p.id === putaran.roomQuestionId)
    : -1

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <div className="text-center">
        <p className="text-sm opacity-70">Kode room</p>
        <p className="font-mono text-4xl font-bold tracking-[0.3em]">{room.kode}</p>
      </div>

      <Roda
        daftar={kolam.map((p) => p.teks)}
        indeksTerpilih={indeksTerpilih >= 0 ? indeksTerpilih : null}
        benih={putaran?.benihAnimasi ?? 0}
      />

      <button
        type="button"
        onClick={putar}
        disabled={memutar || !identitas}
        className="min-h-[64px] rounded-2xl bg-black text-xl font-bold text-white disabled:opacity-40 dark:bg-white dark:text-black"
      >
        {memutar ? 'Memutar…' : 'PUTAR'}
      </button>

      {galatPutar && <p className="text-center text-sm text-red-600">{galatPutar}</p>}

      {putaran && (
        <div className="rounded-2xl border-2 p-5">
          <p className="text-xs uppercase tracking-wide opacity-60">
            Pertanyaan #{putaran.nomorGiliran + 1}
          </p>
          <p className="mt-2 text-2xl font-semibold leading-snug">{putaran.teks}</p>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold opacity-70">
          Peserta ({peserta.length})
        </h2>
        <ul className="flex flex-wrap gap-2">
          {peserta.map((orang) => (
            <li key={orang.id} className="rounded-full border px-3 py-1 text-sm">
              {orang.nama}
              {orang.adalahHost && <span className="ml-1 opacity-50">·host</span>}
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Uji serentak di dua peramban**

Run: `pnpm dev`

1. Jendela biasa: Buat Room sebagai "Juan", catat kode.
2. Jendela penyamaran: Masuk Room dengan kode itu sebagai "Budi".
3. Tekan **PUTAR** di jendela Budi.

Expected: kedua roda berputar dan berhenti di segmen yang sama, dan kotak pertanyaan di bawahnya berisi teks yang identik di kedua jendela.

- [ ] **Step 4: Uji pemulihan setelah muat ulang**

Muat ulang salah satu jendela (F5).
Expected: roda langsung menunjukkan pertanyaan terakhir yang sama, tanpa perlu diputar lagi.

- [ ] **Step 5: Uji kunci anti dua putaran**

Tekan PUTAR di dua jendela hampir bersamaan.
Expected: satu berhasil; satu lagi memunculkan pesan merah dari database. Yang gagal **tetap** melihat pertanyaan yang sama begitu siaran datang — bukan terjebak di layar kosong.

- [ ] **Step 6: Uji, build, commit, deploy**

```bash
pnpm test && pnpm build
git add src/components src/app/room
git commit -m "feat: komponen roda dan layar sesi putaran"
pnpm dlx vercel@latest --prod
```

---

## Definisi Selesai Potongan 3

1. `pnpm test` lulus, 26 uji. `pnpm build` bersih.
2. Dua HP di URL produksi: satu menekan PUTAR, kedua layar berhenti di segmen yang sama dengan teks pertanyaan identik.
3. Muat ulang halaman mengembalikan pertanyaan terakhir tanpa perlu memutar lagi.
4. Dua penekanan hampir bersamaan menghasilkan tepat satu pertanyaan; yang kalah dapat pesan yang bisa dibaca, bukan layar rusak.
5. `putar_roda` dengan token ngawur ditolak.

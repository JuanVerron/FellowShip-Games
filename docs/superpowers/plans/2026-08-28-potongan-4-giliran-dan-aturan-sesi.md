# Potongan 4 — Giliran dan Aturan Sesi: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Urutan peserta diacak sekali saat host menekan Mulai; hanya pemilik giliran yang tombol putarnya hidup; host boleh memutar mewakili siapa pun; host yang memindahkan giliran; dan yang telat bergabung masuk ke ekor antrean.

**Architecture:** Kepemilikan giliran dihitung dari `urutan_giliran` peserta dan `nomor_giliran_sekarang` room — bukan disimpan sebagai penunjuk yang bisa basi. Penegakannya ada di dalam `putar_roda` di database; tombol yang mati di browser cuma penjelas, bukan pengaman. Kewenangan host dibuktikan dengan `host_token`, yang tidak pernah bisa dibaca dari browser siapa pun kecuali pemiliknya.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind, `@supabase/supabase-js`, Vitest, Postgres.

**Spec:** `PRD.md` bagian 4.2 (Mulai sesi), 4.3 (ekor antrean), 4.4 dan Build Order Potongan 4.

**Prasyarat:** Potongan 3 selesai — semua butir "Definisi Selesai Potongan 3" terpenuhi.

## Global Constraints

- Nol biaya. Package manager: pnpm. Uji: `pnpm test`.
- Seluruh antarmuka berbahasa Inggris, termasuk pesan galat yang dilempar fungsi
  database. Rencana ini ditulis sebelum aturan itu ada di `CLAUDE.md`, jadi setiap
  cuplikan kode di bawah yang masih berbahasa Indonesia sudah diperbaiki di repo.
  Potret HP 360px. Sentuh minimal 44px.
- Penguncian giliran ditegakkan di database, bukan hanya dengan `disabled` di browser.
- Urutan diacak tepat sekali saat Mulai, lalu tetap sampai sesi selesai.
- Peserta yang telat bergabung menempati posisi terakhir, bukan disisipkan acak.
- Satu commit per task.

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `supabase/migrations/0005_giliran.sql` | Fungsi `pemilik_giliran`, `mulai_sesi`, `giliran_berikutnya`, serta versi baru `putar_roda` dan `masuk_room` |
| `scripts/verifikasi-giliran.mjs` | Verifikasi seluruh alur giliran lewat jalur anon yang sama dengan browser |
| `src/lib/giliran.ts` | Menghitung siapa pemilik giliran dan siapa yang boleh memutar. Murni, tanpa I/O |
| `src/lib/sesi.ts` | Pembungkus RPC `mulai_sesi` dan `giliran_berikutnya` |
| `src/lib/putaran.ts` | Diperluas: `putarRoda` menerima `hostToken` opsional |
| `src/app/room/[kode]/page.tsx` | Diperluas: dua tampilan (ruang tunggu dan sesi berjalan), penanda giliran, kendali host |

---

### Task 1: Fungsi giliran di database

**Files:**
- Create: `supabase/migrations/0005_giliran.sql`
- Create: `scripts/verifikasi-giliran.mjs`
- Modify: `scripts/verifikasi-putaran.mjs` (ikut tanda tangan `putar_roda` yang baru)

> **Koreksi rencana (nomor migrasi).** Rencana ini menyebut `0004`, tapi nomor
> itu sudah dipakai `0004_kolam_dan_putaran.sql` di Potongan 3 — yang sendirinya
> bergeser dari `0003` karena migrasi pesan antarmuka Inggris. Migrasi potongan
> ini jadi `0005`.

**Interfaces:**
- Consumes: `rooms`, `participants`, `room_secrets`, `participant_secrets`, `spins` (Potongan 2–3)
- Produces:
  - `public.pemilik_giliran(p_room_id uuid, p_nomor int)` → `uuid`
  - `public.mulai_sesi(p_kode text, p_host_token text)` → `void`
  - `public.giliran_berikutnya(p_kode text, p_host_token text)` → `int`
  - `public.putar_roda(p_kode text, p_token text, p_host_token text)` — **menggantikan** versi dua argumen
  - `public.masuk_room(p_kode text, p_nama text)` — versi baru yang menaruh pendatang telat di ekor

- [x] **Step 1: Tulis berkas migrasi**

Buat `supabase/migrations/0005_giliran.sql`. Empat hal berbeda dari cuplikan
awal rencana, dan dua di antaranya memperbaiki cacat yang nyata:

1. **`set search_path = public, extensions`.** Sama seperti di Potongan 3:
   `pgcrypto` dipasang Supabase di skema `extensions`, dan `masuk_room`
   memanggil `gen_random_bytes`. Dengan `public` saja fungsi itu tidak
   ditemukan.

2. **Cuplikan `masuk_room` di rencana mengulang bug ambiguitas dari Potongan 2.**
   Klausa `returns table (room_id ...)` membuat `room_id` jadi variabel
   keluaran, jadi `where room_id = v_room.id` ditolak Postgres karena acuan
   kolomnya ambigu. Galat ini sudah pernah menjaring fungsi yang sama sekali,
   dan cuplikan di rencana menuliskannya kembali. Semua kolom sekarang diawali
   nama tabelnya.

3. **Semua `raise exception` berbahasa Inggris**, karena pesannya ikut tampil
   di layar peserta.

4. **Pelanggaran batasan unik ditangkap**, meneruskan keputusan Potongan 3.
   Di potongan ini penangkapnya justru lebih sering terpakai: karena
   `putar_roda` tidak lagi menambah nomor giliran, penekanan kedua di giliran
   yang sama langsung menabrak batasannya.

- [x] **Step 2: Terapkan dan verifikasi alur lengkap**

```bash
set -a; . ./.env.local; set +a
pnpm dlx supabase@latest db push --linked
node scripts/verifikasi-giliran.mjs
```

Rencana awal menyuruh menempelkan tujuh potong SQL ke SQL Editor dan membaca
hasilnya sendiri. Diganti `scripts/verifikasi-giliran.mjs`, yang menempuh jalur
anon yang sama dengan browser dan bisa diulang kapan saja.

Hasil: **16 lulus, 0 gagal.**

| Yang diperiksa | Hasil |
|---|---|
| Roda terkunci sebelum sesi dimulai | `This session has not started yet.` |
| Peserta biasa tidak boleh memulai sesi | `Only the host can start the session.` |
| Tiga peserta dapat urutan giliran 0, 1, 2 | `Budi:0, Juan:1, Citra:2` |
| Status room jadi `berjalan` di giliran 0 | ya |
| Sesi tidak bisa dimulai dua kali | `This session has already started.` |
| Peserta bukan pemilik giliran ditolak | `It is not your turn yet.` |
| Host boleh memutar mewakili | berhasil di giliran 0 |
| Putaran dicatat atas nama pemilik giliran | tercatat `Budi`, bukan host |
| Memutar roda tidak memindah giliran | nomor giliran tetap 0 |
| Giliran yang sudah punya pertanyaan ditolak | `This turn already has its question.` |
| Peserta biasa tidak boleh memindah giliran | `Only the host can move to the next turn.` |
| Host memindah giliran | ke 1 |
| Pemilik giliran berikutnya boleh memutar sendiri | berhasil, tanpa host token |
| Pendatang telat ke ekor | `Dodi:3`, terbesar |
| Urutan peserta lama tidak bergeser | ya |
| Pengacakan benar-benar acak | 6 urutan berbeda dari 6 room |

- [x] **Step 3: Sesuaikan skrip verifikasi Potongan 3**

`scripts/verifikasi-putaran.mjs` memanggil `putar_roda` dua argumen dan memutar
roda dari ruang tunggu — keduanya tidak berlaku lagi. Skripnya diperbarui:
memanggil `mulai_sesi` dulu, dan mengirim `p_host_token`.

Satu uji di dalamnya berubah arti dan jadi jauh lebih berguna. Di Potongan 3
tiga penekanan bersamaan selalu berbaris rapi dan masing-masing dapat nomor
gilirannya sendiri, jadi kuncinya tidak pernah tersentuh. Sekarang
`putar_roda` tidak menambah nomor giliran sendiri, sehingga ketiganya benar-
benar mengincar nomor yang sama:

```
OK  tiga penekanan bersamaan menghasilkan tepat satu pertanyaan — 1 berhasil, 2 ditolak
OK  yang kalah dapat kalimat yang bisa dibaca, bukan galat mentah
    — "This turn already has its question." | "It is not your turn yet."
```

Tabrakan yang dipaksa lewat Management API tidak dibutuhkan lagi dan dibuang.

- [x] **Step 4: Catatan — Realtime meleset sekali sesudah setiap `db push`**

Terjadi dua kali dengan pola yang sama: jalan pertama sesudah migrasi
diterapkan tidak menerima satu pun siaran dalam 15 detik, lalu semua jalan
berikutnya lulus dalam 377–597 ms. Perubahan skema tampaknya membuat layanan
Realtime perlu menyusun ulang keadaannya sebentar.

Ini artefak saat deploy, bukan saat sesi: tidak ada perubahan skema yang
terjadi di tengah sesi fellowship. Yang perlu diingat cuma satu — **jangan
percaya jalan pertama sesudah `db push`; ulangi sekali.**

- [x] **Step 5: Commit**

```bash
git add supabase/migrations/0005_giliran.sql scripts/verifikasi-giliran.mjs scripts/verifikasi-putaran.mjs
git commit -m "feat: pengacakan urutan, penguncian giliran, dan ekor antrean"
```

---

### Task 2: Perhitungan giliran di sisi klien

**Files:**
- Create: `src/lib/giliran.ts`
- Test: `src/lib/__tests__/giliran.test.ts`

**Interfaces:**
- Consumes: `Peserta` (Potongan 2)
- Produces:
  - `pesertaTerurut(peserta: Peserta[]): Peserta[]`
  - `pemilikGiliran(peserta: Peserta[], nomorGiliran: number): Peserta | null`
  - `bolehMemutar(args: { participantId: string | null; adalahHost: boolean; pemilik: Peserta | null }): boolean`

- [ ] **Step 1: Tulis uji yang gagal**

Buat `src/lib/__tests__/giliran.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { bolehMemutar, pemilikGiliran, pesertaTerurut } from '@/lib/giliran'
import type { Peserta } from '@/lib/room'

function orang(id: string, urutanGiliran: number | null): Peserta {
  return { id, nama: id, urutanGiliran, adalahHost: false }
}

describe('pesertaTerurut', () => {
  it('mengurutkan menurut urutan giliran', () => {
    const hasil = pesertaTerurut([orang('c', 2), orang('a', 0), orang('b', 1)])
    expect(hasil.map((o) => o.id)).toEqual(['a', 'b', 'c'])
  })

  it('membuang peserta yang belum punya urutan', () => {
    const hasil = pesertaTerurut([orang('a', 0), orang('x', null)])
    expect(hasil.map((o) => o.id)).toEqual(['a'])
  })
})

describe('pemilikGiliran', () => {
  const daftar = [orang('a', 0), orang('b', 1), orang('c', 2)]

  it('memilih orang pertama di giliran nol', () => {
    expect(pemilikGiliran(daftar, 0)?.id).toBe('a')
  })

  it('berputar kembali ke awal setelah orang terakhir', () => {
    expect(pemilikGiliran(daftar, 3)?.id).toBe('a')
    expect(pemilikGiliran(daftar, 4)?.id).toBe('b')
  })

  it('mengembalikan null saat belum ada yang punya urutan', () => {
    expect(pemilikGiliran([orang('x', null)], 0)).toBeNull()
  })
})

describe('bolehMemutar', () => {
  const pemilik = orang('a', 0)

  it('mengizinkan pemilik giliran', () => {
    expect(bolehMemutar({ participantId: 'a', adalahHost: false, pemilik })).toBe(true)
  })

  it('menolak peserta lain', () => {
    expect(bolehMemutar({ participantId: 'b', adalahHost: false, pemilik })).toBe(false)
  })

  it('mengizinkan host walau bukan gilirannya', () => {
    expect(bolehMemutar({ participantId: 'b', adalahHost: true, pemilik })).toBe(true)
  })

  it('menolak orang yang belum punya identitas', () => {
    expect(bolehMemutar({ participantId: null, adalahHost: false, pemilik })).toBe(false)
  })
})
```

- [ ] **Step 2: Jalankan uji dan pastikan gagal**

Run: `pnpm test`
Expected: GAGAL — `Cannot find module '@/lib/giliran'`.

- [ ] **Step 3: Tulis implementasinya**

Buat `src/lib/giliran.ts`:

```typescript
import type { Peserta } from '@/lib/room'

export function pesertaTerurut(peserta: Peserta[]): Peserta[] {
  return peserta
    .filter((orang) => orang.urutanGiliran !== null)
    .sort((a, b) => (a.urutanGiliran ?? 0) - (b.urutanGiliran ?? 0))
}

export function pemilikGiliran(
  peserta: Peserta[],
  nomorGiliran: number,
): Peserta | null {
  const terurut = pesertaTerurut(peserta)
  if (terurut.length === 0) return null
  return terurut[nomorGiliran % terurut.length]
}

export function bolehMemutar({
  participantId,
  adalahHost,
  pemilik,
}: {
  participantId: string | null
  adalahHost: boolean
  pemilik: Peserta | null
}): boolean {
  if (!participantId) return false
  if (adalahHost) return true
  return pemilik?.id === participantId
}
```

- [ ] **Step 4: Jalankan uji dan pastikan lulus**

Run: `pnpm test`
Expected: LULUS — 8 berkas uji, 35 uji.

- [ ] **Step 5: Commit**

```bash
git add src/lib/giliran.ts src/lib/__tests__/giliran.test.ts
git commit -m "feat: perhitungan pemilik giliran dan hak memutar"
```

---

### Task 3: Kendali sesi dan layar dua keadaan

**Files:**
- Create: `src/lib/sesi.ts`
- Modify: `src/lib/putaran.ts` (tambah argumen `hostToken`)
- Modify: `src/app/room/[kode]/page.tsx`

**Interfaces:**
- Consumes: `mulai_sesi`, `giliran_berikutnya`, `putar_roda` versi tiga argumen (Task 1); `pemilikGiliran`, `bolehMemutar` (Task 2)
- Produces:
  - `mulaiSesi(kode: string, hostToken: string): Promise<void>`
  - `giliranBerikutnya(kode: string, hostToken: string): Promise<number>`
  - `putarRoda(kode: string, token: string, hostToken: string | null): Promise<Putaran>` — tanda tangan baru

- [ ] **Step 1: Tulis pembungkus kendali sesi**

Buat `src/lib/sesi.ts`:

```typescript
import { buatKlienSupabase } from '@/lib/supabase'

export async function mulaiSesi(kode: string, hostToken: string): Promise<void> {
  const { error } = await buatKlienSupabase().rpc('mulai_sesi', {
    p_kode: kode,
    p_host_token: hostToken,
  })
  if (error) throw new Error(error.message)
}

export async function giliranBerikutnya(
  kode: string,
  hostToken: string,
): Promise<number> {
  const { data, error } = await buatKlienSupabase().rpc('giliran_berikutnya', {
    p_kode: kode,
    p_host_token: hostToken,
  })
  if (error) throw new Error(error.message)
  return data as number
}
```

- [ ] **Step 2: Tambah argumen host pada `putarRoda`**

Di `src/lib/putaran.ts`, ganti fungsi `putarRoda`:

```typescript
export async function putarRoda(
  kode: string,
  token: string,
  hostToken: string | null,
): Promise<Putaran> {
  const { data, error } = await buatKlienSupabase()
    .rpc('putar_roda', {
      p_kode: kode,
      p_token: token,
      p_host_token: hostToken,
    })
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
```

- [ ] **Step 3: Ganti layar room dengan dua keadaan**

Ganti seluruh isi `src/app/room/[kode]/page.tsx`:

```tsx
'use client'

import { use, useEffect, useState } from 'react'
import { Roda } from '@/components/Roda'
import { useRoom } from '@/hooks/useRoom'
import { bolehMemutar, pemilikGiliran, pesertaTerurut } from '@/lib/giliran'
import { bacaIdentitas, type Identitas } from '@/lib/identitas'
import { putarRoda } from '@/lib/putaran'
import { giliranBerikutnya, mulaiSesi } from '@/lib/sesi'

export default function HalamanRoom({
  params,
}: {
  params: Promise<{ kode: string }>
}) {
  const { kode: kodeMentah } = use(params)
  const kode = kodeMentah.toUpperCase()
  const { room, peserta, kolam, putaran, memuat, galat } = useRoom(kode)
  const [identitas, setIdentitas] = useState<Identitas | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [pesanGalat, setPesanGalat] = useState<string | null>(null)

  useEffect(() => {
    setIdentitas(bacaIdentitas(kode))
  }, [kode])

  const adalahHost = identitas?.hostToken != null

  async function jalankan(tugas: () => Promise<unknown>) {
    setSibuk(true)
    setPesanGalat(null)
    try {
      await tugas()
    } catch (e) {
      setPesanGalat(e instanceof Error ? e.message : 'Gagal')
    } finally {
      setSibuk(false)
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

  // ——— Ruang tunggu ———
  if (room.status === 'lobby') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 p-6">
        <div className="text-center">
          <p className="text-sm opacity-70">Kode room</p>
          <p className="font-mono text-5xl font-bold tracking-[0.3em]">{room.kode}</p>
          <p className="mt-2 text-sm opacity-70">Sebutkan kode ini ke teman-teman</p>
        </div>

        <div>
          <h2 className="mb-3 font-semibold">Peserta ({peserta.length})</h2>
          <ul className="flex flex-col gap-2">
            {peserta.map((orang) => (
              <li
                key={orang.id}
                className="flex min-h-[44px] items-center justify-between rounded-lg border px-3"
              >
                <span>{orang.nama}</span>
                {orang.adalahHost && <span className="text-xs opacity-60">host</span>}
              </li>
            ))}
          </ul>
        </div>

        {pesanGalat && <p className="text-sm text-red-600">{pesanGalat}</p>}

        {adalahHost ? (
          <button
            type="button"
            disabled={sibuk}
            onClick={() => jalankan(() => mulaiSesi(kode, identitas!.hostToken!))}
            className="min-h-[56px] rounded-xl bg-black text-lg font-bold text-white disabled:opacity-40 dark:bg-white dark:text-black"
          >
            {sibuk ? 'Memulai…' : 'Mulai Sesi'}
          </button>
        ) : (
          <p className="text-center text-sm opacity-70">Menunggu host memulai sesi…</p>
        )}
      </main>
    )
  }

  // ——— Sesi berjalan ———
  const pemilik = pemilikGiliran(peserta, room.nomorGiliranSekarang)
  const giliranku = pemilik?.id === identitas?.participantId
  const bolehTekan = bolehMemutar({
    participantId: identitas?.participantId ?? null,
    adalahHost,
    pemilik,
  })
  const indeksTerpilih = putaran
    ? kolam.findIndex((p) => p.id === putaran.roomQuestionId)
    : -1
  const putaranIniSudahAda = putaran?.nomorGiliran === room.nomorGiliranSekarang

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 p-6">
      <div
        className={`rounded-2xl p-4 text-center ${
          giliranku ? 'bg-black text-white dark:bg-white dark:text-black' : 'border-2'
        }`}
      >
        {giliranku ? (
          <p className="text-2xl font-bold">Giliranmu!</p>
        ) : (
          <p className="text-lg">
            Giliran <span className="font-bold">{pemilik?.nama ?? '—'}</span>
          </p>
        )}
      </div>

      <Roda
        daftar={kolam.map((p) => p.teks)}
        indeksTerpilih={indeksTerpilih >= 0 ? indeksTerpilih : null}
        benih={putaran?.benihAnimasi ?? 0}
      />

      <button
        type="button"
        disabled={sibuk || !bolehTekan || putaranIniSudahAda}
        onClick={() =>
          jalankan(() =>
            putarRoda(kode, identitas!.token, identitas?.hostToken ?? null),
          )
        }
        className="min-h-[64px] rounded-2xl bg-black text-xl font-bold text-white disabled:opacity-40 dark:bg-white dark:text-black"
      >
        {putaranIniSudahAda ? 'Sudah diputar' : sibuk ? 'Memutar…' : 'PUTAR'}
      </button>

      {pesanGalat && <p className="text-center text-sm text-red-600">{pesanGalat}</p>}

      {putaran && (
        <div className="rounded-2xl border-2 p-5">
          <p className="text-2xl font-semibold leading-snug">{putaran.teks}</p>
        </div>
      )}

      {adalahHost && (
        <button
          type="button"
          disabled={sibuk}
          onClick={() => jalankan(() => giliranBerikutnya(kode, identitas!.hostToken!))}
          className="min-h-[52px] rounded-xl border-2 font-semibold disabled:opacity-40"
        >
          Giliran berikutnya →
        </button>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold opacity-70">Antrean</h2>
        <ol className="flex flex-wrap gap-2">
          {pesertaTerurut(peserta).map((orang, i) => (
            <li
              key={orang.id}
              className={`rounded-full border px-3 py-1 text-sm ${
                orang.id === pemilik?.id ? 'border-black font-bold dark:border-white' : 'opacity-60'
              }`}
            >
              {i + 1}. {orang.nama}
            </li>
          ))}
        </ol>
      </div>
    </main>
  )
}
```

Tombol putar mati saat `putaranIniSudahAda` supaya orang tidak menekan berulang dan menerima pesan galat dari database sebagai hadiahnya. Penolakan di database tetap ada sebagai pengaman; yang di browser cuma supaya sopan.

- [ ] **Step 4: Uji tiga peramban**

Run: `pnpm dev`

1. Jendela A: Buat Room sebagai "Juan".
2. Jendela penyamaran B: masuk sebagai "Budi". Jendela penyamaran lain C: masuk sebagai "Citra".
3. Di A tekan **Mulai Sesi**.

Expected: ketiga layar berpindah ke tampilan sesi. Antrean menunjukkan urutan yang sama di ketiganya, dan urutan itu **tidak** sama dengan urutan bergabung setiap kali dicoba ulang.

- [ ] **Step 5: Uji penguncian giliran**

Expected: hanya layar pemilik giliran yang tombolnya hidup dan bertuliskan "Giliranmu!". Layar A (host) tombolnya juga hidup walau bukan gilirannya — itu memang disengaja.

- [ ] **Step 6: Uji perpindahan giliran dan pendatang telat**

Tekan **Giliran berikutnya** di A. Expected: penanda pindah ke orang berikutnya di ketiga layar.

Lalu buka jendela keempat D dan masuk sebagai "Dodi".
Expected: Dodi muncul di **posisi terakhir** antrean di semua layar.

- [ ] **Step 7: Uji, build, commit, deploy**

```bash
pnpm test && pnpm build
git add src/lib/sesi.ts src/lib/putaran.ts src/app/room
git commit -m "feat: kendali sesi, penanda giliran, dan antrean"
pnpm dlx vercel@latest --prod
```

---

## Definisi Selesai Potongan 4

1. `pnpm test` lulus, 35 uji. `pnpm build` bersih.
2. Tiga HP di URL produksi: setelah host menekan Mulai, urutan antrean sama di ketiganya dan berbeda dari urutan bergabung.
3. Hanya layar pemilik giliran yang tombol putarnya hidup; layar host juga hidup.
4. `putar_roda` dengan token peserta bukan pemilik giliran dan tanpa host token ditolak database dengan `sekarang bukan giliranmu`.
5. HP keempat yang bergabung di tengah sesi muncul di posisi terakhir antrean.
6. Giliran hanya berpindah saat host menekan tombol, tidak pernah otomatis setelah roda berhenti.

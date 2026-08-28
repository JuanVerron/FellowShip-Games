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

- [x] **Step 1: Tulis uji yang gagal**

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

- [x] **Step 2: Jalankan uji dan pastikan gagal**

Run: `pnpm test`
Expected: GAGAL — `Cannot find module '@/lib/giliran'`.

- [x] **Step 3: Tulis implementasinya**

Buat `src/lib/giliran.ts`:

```typescript
import type { Peserta } from '@/lib/room'

export function pesertaTerurut(peserta: Peserta[]): Peserta[] {
  // Menyalin dulu sebelum mengurutkan. `sort` mengubah lariknya di tempat, dan
  // larik yang masuk ke sini datang langsung dari state React — mengubahnya
  // berarti mengubah state tanpa lewat setter. Cuplikan awal rencana lupa ini.
  return peserta
    .filter((orang) => orang.urutanGiliran !== null)
    .slice()
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

- [x] **Step 4: Jalankan uji dan pastikan lulus**

Run: `pnpm test`
Hasil: LULUS — 11 berkas uji, 62 uji. Rencana ini menebak 8 berkas dan 35 uji;
angka acuannya bergeser ke atas karena Potongan 2 dan 3 menambah beberapa hal
di luar rencana.

- [x] **Step 5: Commit**

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
- Consumes: `mulai_sesi`, `giliran_berikutnya`, `putar_roda` versi tiga argumen (Task 1); `pemilikGiliran`, `bolehMemutar`, `pesertaTerurut` (Task 2)
- Produces:
  - `mulaiSesi(kode: string, hostToken: string): Promise<void>`
  - `giliranBerikutnya(kode: string, hostToken: string): Promise<number>`
  - `putarRoda(kode: string, token: string, hostToken: string | null): Promise<Putaran>` — tanda tangan baru

- [x] **Step 1: Tulis pembungkus kendali sesi**

Buat `src/lib/sesi.ts` berisi `mulaiSesi` dan `giliranBerikutnya`.

- [x] **Step 2: Tambah argumen host pada `putarRoda`**

`src/lib/putaran.ts` meneruskan `p_host_token`. Nilainya `null` untuk peserta
biasa, dan itu memang dikirim — bukan dihilangkan — supaya database yang
memutuskan, bukan browser.

- [x] **Step 3: Perluas layar room jadi dua keadaan**

> **Koreksi rencana.** Untuk ketiga kalinya di dua potongan, rencana menyuruh
> mengganti seluruh isi `src/app/room/[kode]/page.tsx`. Cuplikan penggantinya
> kehilangan tautan beranda, penanda diri sendiri, pembuangan identitas basi,
> penunjuk status sambungan, dan pembacaan identitas lewat `useSyncExternalStore`
> yang menjaga hidrasi tidak pecah. Yang dikerjakan: **memperluas**.

Yang bertambah dibanding Potongan 3:

- Dua keadaan: ruang tunggu (`status = 'lobby'`) dan sesi berjalan. Ruang
  tunggu tidak menampilkan roda sama sekali.
- Spanduk giliran: `Your turn!` berlatar kuning untuk pemiliknya, atau
  `<nama>'s turn` berbingkai untuk yang lain.
- Label tombol ikut menjelaskan siapa yang diwakili. Host yang menekan di
  giliran orang lain membaca `SPIN FOR BUDI`, bukan `SPIN` polos — kewenangan
  yang tidak biasa itu jadi terlihat, bukan tersembunyi.
- `Already spun` saat giliran sekarang sudah punya pertanyaan, dan tombolnya
  mati. Penolakan di database tetap ada sebagai pengaman; yang di browser cuma
  supaya orang tidak menekan berulang dan menerima pesan galat sebagai hadiah.
- `Next turn →` hanya muncul di layar host.
- Antrean bernomor, yang bukan giliran sekarang diredupkan.
- Baris peserta dipakai bersama kedua keadaan lewat satu fungsi, supaya penanda
  `(you)` dan label `host` tidak ditulis dua kali dengan risiko berbeda.

Satu perbaikan di luar rencana: `usiaDetik` dijaga tidak pernah negatif.
Pewaktu satu detik yang menghidupi `sekarang` dilambatkan browser saat tabnya
tidak di depan, jadi begitu tab kembali dan data ditarik ulang, penunjuk status
sempat menulis `updated -22s ago`. Terlihat saat uji peramban, bukan saat
membaca kode.

- [x] **Step 4: Uji alur di peramban**

Rencana awal menyuruh membuka empat jendela penyamaran dan menekan tombolnya
sendiri. Yang dikerjakan: peramban dikemudikan otomatis, dan pemeriksaan yang
tidak butuh mata dipindahkan ke `scripts/verifikasi-giliran.mjs` (Task 1).

Satu hal perlu diakali. Identitas hidup di `localStorage`, yang dibagi semua
tab dengan asal yang sama — jadi dua tab pada satu asal selalu jadi orang yang
sama. Jalan keluarnya memakai dua asal berbeda. `localhost` dan `127.0.0.1`
gagal: `next dev` tidak menghidrasi halaman yang dibuka dari asal kedua, dan
layarnya berhenti di `Loading…` selamanya. Yang berhasil adalah dua asal di
produksi — domain tetap dan URL deployment — karena keduanya sah dan sudah
terbangun penuh.

Hasil di layar host (`localhost`, sesi dimulai dari ruang tunggu):

| Yang diperiksa | Hasil |
|---|---|
| Ruang tunggu tidak menampilkan roda | benar |
| Peserta kedua muncul lewat Realtime | `Participants (2)` tanpa muat ulang |
| Mulai Sesi memindahkan layar ke sesi | spanduk `Budi's turn` |
| Urutan antrean sama di layar itu | `1. Budi, 2. Juan` |
| Host melihat kewenangannya | tombol `SPIN FOR BUDI`, hidup |
| `Next turn →` memindah giliran | spanduk jadi `Your turn!`, tombol jadi `SPIN` |
| Memutar mengisi pertanyaan | `QUESTION #2 — When did you last laugh until it hurt?` |
| Giliran yang sudah diputar terkunci | tombol `Already spun`, `disabled` |

- [x] **Step 5: Uji, build, commit, deploy**

```bash
pnpm test && pnpm build && pnpm lint
git add -A && git commit -m "feat: kendali sesi, penanda giliran, dan antrean"
pnpm dlx vercel@latest --prod
```

---

## Definisi Selesai Potongan 4

1. **Terpenuhi.** `pnpm test` lulus 62 uji di 11 berkas; `pnpm build` dan
   `pnpm lint` bersih.
2. **Terpenuhi.** Dua layar di produksi, masing-masing dengan identitasnya
   sendiri: sesudah host menekan Mulai, keduanya menampilkan antrean
   `1. Budi, 2. Citra, 3. Juan` — urutan yang berbeda dari urutan bergabung
   (`Juan, Budi, Citra`). Enam room percobaan di `scripts/verifikasi-giliran.mjs`
   menghasilkan enam urutan berbeda.
3. **Terpenuhi.** Di giliran Citra, layar Budi menampilkan `WAITING FOR CITRA`
   dengan tombol mati, sementara layar host menampilkan `SPIN FOR CITRA` dengan
   tombol hidup.
4. **Terpenuhi.** `putar_roda` dengan token peserta bukan pemilik giliran dan
   `p_host_token => null` ditolak `It is not your turn yet.`
5. **Terpenuhi.** Dodi yang bergabung di tengah sesi muncul di posisi keempat
   pada kedua layar tanpa muat ulang, dan urutan tiga orang sebelumnya tidak
   bergeser.
6. **Terpenuhi.** Memutar roda tidak menyentuh `nomor_giliran_sekarang`; angka
   itu hanya berubah saat host memanggil `giliran_berikutnya`.

Seluruhnya diverifikasi lewat `node scripts/verifikasi-giliran.mjs` (16 lulus,
0 gagal), `node scripts/verifikasi-putaran.mjs` (11 lulus, 0 gagal), dan otomasi
peramban di dua asal produksi.

## Yang dikerjakan di luar rencana

1. **Nomor migrasi bergeser ke 0005**, mengikuti pergeseran di Potongan 3.
2. **`scripts/verifikasi-giliran.mjs` dan `scripts/siapkan-room-uji.mjs`.**
   Yang pertama menggantikan tujuh potong SQL yang harus ditempel sendiri ke
   dashboard. Yang kedua menyiapkan satu room berisi beberapa orang lewat RPC
   dan mencetak identitas masing-masing, karena mengetik di formulir lewat
   otomasi peramban tidak sampai ke tab yang tidak sedang di depan.
3. **`usiaDetik` dijaga tidak pernah negatif.** Penunjuk status sempat menulis
   `updated -22s ago` karena pewaktu satu detiknya dilambatkan browser saat tab
   tidak di depan.
4. **Label tombol dibedakan antara host dan peserta biasa.** Semula keduanya
   membaca `SPIN FOR CITRA`; untuk peserta biasa itu menjanjikan sesuatu yang
   cuma boleh dilakukan host, jadi ia jadi `WAITING FOR CITRA`.

## Yang diketahui belum beres

**Pendatang telat bisa memindahkan pemilik giliran yang sedang berjalan.**
Kepemilikan dihitung `nomor_giliran % jumlah_peserta`, di kode maupun di
database. Selama antrean belum pernah berputar penuh, penambahan orang tidak
terasa. Begitu `nomor_giliran` sudah melewati jumlah peserta, satu orang yang
bergabung mengubah pembaginya, dan penanda giliran bisa melompat ke orang lain
di tengah giliran yang sedang berjalan.

Ini tidak melanggar keputusan di `CLAUDE.md` — pendatang telat tetap masuk ke
ekor antrean, bukan disisipkan acak — tapi ia tetap kejutan yang tidak enak.
Perbaikannya menuntut jumlah peserta ikut dicatat per giliran, bukan dihitung
ulang tiap kali. Ditunda ke Potongan 6, yang memang bagian penghalusan sesi.


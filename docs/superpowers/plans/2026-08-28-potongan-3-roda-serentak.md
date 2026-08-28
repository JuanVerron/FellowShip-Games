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
| `scripts/verifikasi-putaran.mjs` | Verifikasi ujung ke ujung lewat jalur anon yang sama dengan browser: RPC, Realtime, dan tabrakan yang dipaksa |
| `scripts/sql.mjs` | Menjalankan SQL sembarang di project lewat Management API, pengganti SQL Editor untuk verifikasi dari terminal |
| `src/data/contoh-pertanyaan.ts` | Delapan pertanyaan contoh berbahasa Inggris. **Sementara** — dihapus di Potongan 5 saat bank sungguhan masuk |
| `src/lib/roda.ts` | Matematika sudut roda, termasuk `sudutKumulatif` yang menjaga roda selalu maju. Murni, tanpa I/O, bisa diuji tanpa DOM |
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

- [x] **Step 1: Tulis uji yang gagal**

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

- [x] **Step 2: Jalankan uji dan pastikan gagal**

Run: `pnpm test`
Expected: GAGAL — `Cannot find module '@/lib/roda'`.

- [x] **Step 3: Tulis implementasinya**

Buat `src/lib/roda.ts`:

```typescript
export const PUTARAN_MINIMAL = 4
export const RAGAM_PUTARAN = 3

export function sudutSegmen(jumlah: number): number {
  if (jumlah < 1) throw new Error('This room has no questions left.')
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

- [x] **Step 4: Jalankan uji dan pastikan lulus**

Run: `pnpm test`
Hasil: LULUS — 9 berkas uji, 42 uji. Rencana ini menebak 7 berkas dan
26 uji; Potongan 2 berakhir dengan 8 berkas dan 36 uji karena tiga tambahan
di luar rencana, jadi angka acuannya bergeser ke atas.

- [x] **Step 5: Commit**

```bash
git add src/lib/roda.ts src/lib/__tests__/roda.test.ts
git commit -m "feat: matematika sudut roda"
```

---

### Task 3: Pembungkus putaran dan perluasan hook

**Files:**
- Create: `src/data/contoh-pertanyaan.ts`
- Create: `src/lib/putaran.ts`
- Test: `src/lib/__tests__/putaran.test.ts`
- Modify: `src/hooks/useRoom.ts` (tambah kolam dan putaran terakhir)
- Modify: `src/app/buat/page.tsx` (kirim daftar pertanyaan ke `buatRoom`)
- Modify: `src/lib/room.ts` (tanda tangan `buatRoom` bertambah satu argumen)

**Interfaces:**
- Consumes: `putar_roda`, `buat_room` versi baru (Task 1)
- Produces:
  - `CONTOH_PERTANYAAN: string[]`
  - `type PertanyaanKolam = { id: string; teks: string; urutan: number; sudahKeluar: boolean }`
  - `type Putaran = { roomQuestionId: string; teks: string; nomorGiliran: number; benihAnimasi: number }`
  - `keKolam`, `kePutaran` — penerjemah baris murni, sejalan dengan `keRoom`/`kePeserta` di `src/lib/room.ts`
  - `putarRoda(kode: string, token: string): Promise<Putaran>`
  - `ambilKolam(roomId: string): Promise<PertanyaanKolam[]>`
  - `ambilPutaranTerakhir(roomId: string): Promise<Putaran | null>`
  - `buatRoom(namaHost: string, pertanyaan: string[])` — tanda tangan baru
  - `useRoom(kode)` mengembalikan tambahan: `kolam: PertanyaanKolam[]`, `putaran: Putaran | null`

- [x] **Step 1: Tulis pertanyaan contoh sementara**

Buat `src/data/contoh-pertanyaan.ts` berisi delapan pertanyaan. **Berbahasa
Inggris**, bukan Indonesia seperti tertulis di versi awal rencana ini: teksnya
dibaca peserta di layar, jadi ia antarmuka.

- [x] **Step 2: Tulis pembungkus putaran**

Buat `src/lib/putaran.ts`. Bedanya dari cuplikan awal rencana: pemetaan baris
ditarik keluar jadi `keKolam` dan `kePutaran` yang murni, mengikuti pola
`keRoom`/`kePeserta` yang sudah ada di `src/lib/room.ts`. Itu membuat bagian
yang paling gampang salah — PostgREST mengembalikan relasi bertingkat kadang
sebagai objek, kadang sebagai larik — bisa diuji tanpa menyentuh jaringan.

`ambilPutaranTerakhir` inilah yang membuat layar pulih benar setelah dimuat
ulang: keadaan roda tidak disimpan di memori browser, tapi selalu dibaca ulang
dari putaran terakhir yang tercatat.

- [x] **Step 3: Ubah tanda tangan `buatRoom`**

`src/lib/room.ts` menerima argumen kedua `pertanyaan: string[]` dan
meneruskannya sebagai `p_pertanyaan`. `src/app/buat/page.tsx` memanggil
`buatRoom(rapi, CONTOH_PERTANYAAN)`.

- [x] **Step 4: Perluas hook**

> **Koreksi rencana.** Versi awal rencana menyuruh **mengganti seluruh isi**
> `src/hooks/useRoom.ts` dengan cuplikan yang lebih pendek. Kalau dituruti,
> tiga hal yang lahir di Potongan 2 ikut terhapus: `statusSaluran`,
> `diperbaruiPada`, dan penarikan ulang saat tab kembali terlihat — penjagaan
> yang justru ada karena browser HP memutus WebSocket saat tab tidak di depan.
> Yang dikerjakan: **memperluas**, bukan mengganti.

Yang berubah:

- `kolam` dan `putaran` masuk sebagai state baru dan ikut dikembalikan.
- `muatUlang` menarik peserta, kolam, dan putaran terakhir lewat satu
  `Promise.all`, bukan berurutan. Satu siaran bisa memicu muat ulang beberapa
  kali per detik, dan tiga perjalanan bolak-balik yang antre terasa jelas di
  jaringan HP.
- Langganan `postgres_changes` dijadikan perulangan atas empat tabel: `rooms`,
  `participants`, `room_questions`, `spins`.
- Cabang "room tidak ada" mengosongkan kolam dan putaran, supaya sisa layar
  tidak menampilkan data room sebelumnya.

- [x] **Step 5: Pastikan uji dan build masih bersih**

Run: `pnpm test && pnpm build`
Hasil: uji LULUS 46 di 10 berkas, build tanpa galat TypeScript.

- [x] **Step 6: Commit**

```bash
git add src/data src/lib/putaran.ts src/lib/__tests__/putaran.test.ts \
        src/lib/room.ts src/hooks/useRoom.ts src/app/buat/page.tsx
git commit -m "feat: pembungkus putaran dan hook yang menyimak spins"
```

---

### Task 4: Komponen roda dan layar sesi

**Files:**
- Create: `src/components/Roda.tsx`
- Create: `scripts/verifikasi-putaran.mjs`
- Modify: `src/lib/roda.ts` (tambah `sudutKumulatif`)
- Modify: `src/app/room/[kode]/page.tsx`

**Interfaces:**
- Consumes: `sudutKumulatif` (Task 2); `putarRoda`, `useRoom` (Task 3); `bacaIdentitas` (Potongan 2)
- Produces: komponen `<Roda daftar={string[]} indeksTerpilih={number | null} benih={number} nomorGiliran={number | null} />`

- [x] **Step 1: Buat komponen roda**

Buat `src/components/Roda.tsx`. Empat hal di bawah ini berbeda dari cuplikan
awal rencana, dan tiga di antaranya memperbaiki cacat yang nyata:

1. **Label digeser 90 derajat.** `conic-gradient` mulai dari jam 12 dan
   berjalan searah jarum jam; `rotate()` di CSS mulai dari sumbu X yang
   menunjuk jam 3. Cuplikan awal memakai sudut segmen apa adanya, jadi setiap
   label meleset seperempat lingkaran dari warnanya sendiri.

2. **Label jadi batang selebar radius, bukan `translateX(24px)`.** Persentase
   pada `translateX` dihitung dari lebar elemennya sendiri — lebar teks —
   bukan dari roda, jadi jarak tetap dalam piksel adalah satu-satunya cara
   cuplikan awal bisa bekerja, dan jaraknya tidak ikut mengecil di layar
   sempit. Bentuk sekarang: `w-1/2 origin-left` yang diputar dari pusat, dengan
   `truncate` mengurus teks yang kepanjangan.

3. **Roda tidak pernah berputar mundur.** `sudutAkhir` giliran berikutnya bisa
   lebih kecil dari giliran sekarang, dan CSS akan memutar ke arah sebaliknya.
   `sudutKumulatif` di `src/lib/roda.ts` menambahkan kelipatan
   `PUTARAN_MAKSIMAL * 360` per nomor giliran: dijamin naik terus, dan karena
   kelipatannya bulat dalam 360 posisi berhentinya tidak bergeser sedikit pun.

4. **Layar yang baru dimuat ulang tidak memutar ulang animasinya.** Nomor
   giliran yang sudah ada saat komponen pertama tampil disimpan sebagai state
   awal; selama nomornya masih sama, kelas transisi tidak dipasang dan roda
   langsung berada di posisi akhir. Putaran yang datang sesudahnya punya nomor
   berbeda, jadi ia beranimasi. Dipakai state, bukan ref, supaya nilainya
   ditentukan sekali di render pertama dan tidak bergeser saat React
   menjalankan efek dua kali di mode dev.

5. **Label di paruh kiri dibalik supaya tetap tegak.** Terlihat baru setelah
   roda tampil di produksi: separuh label berdiri terbalik, karena kotaknya
   diputar lebih dari 180 derajat. Yang dibalik cukup teksnya, di tempat —
   kotaknya tetap menunjuk segmennya.

Kelas `motion-safe:` membuat animasi otomatis mati bagi orang yang menyalakan
"kurangi animasi" — hasilnya tetap sampai, cuma tanpa putaran panjang.

- [x] **Step 2: Perluas layar room**

> **Koreksi rencana.** Sama seperti `useRoom` di Task 3, versi awal rencana
> menyuruh mengganti seluruh isi `src/app/room/[kode]/page.tsx`. Cuplikan
> penggantinya tidak punya tautan beranda, penanda diri sendiri, pembuangan
> identitas basi, maupun penunjuk status sambungan — semuanya lahir di
> Potongan 2. Yang dikerjakan: **memperluas**.

Yang bertambah: komponen roda, tombol SPIN setinggi 72px, kotak pertanyaan
terpilih, dan baris galat merah. Orang yang membuka URL room tanpa pernah
bergabung tidak mendapat tombol mati tanpa penjelasan, melainkan tautan
"Join this room to spin".

`indeksTerpilih` dihitung dengan `findIndex` lalu `-1` diubah jadi `null`.
Tanpa itu, pertanyaan yang tidak lagi ada di kolam akan mengirim `-1` ke
perhitungan sudut dan memutar roda ke arah yang salah.

- [x] **Step 3: Uji serentak lewat skrip, bukan dua jendela**

Rencana awal menyuruh membuka dua jendela peramban dan menekan tombolnya
sendiri. Diganti `scripts/verifikasi-putaran.mjs`, yang menempuh jalur yang
sama persis dengan browser — anon key, RPC, langganan Realtime — tapi bisa
diulang kapan saja dan tidak bergantung pada mata manusia:

```bash
node scripts/verifikasi-putaran.mjs
```

Hasil: 12 lulus, 0 gagal, empat kali berturut-turut. Siaran `INSERT` pada
`spins` sampai di layar kedua dalam 234-739 ms, membawa `room_question_id` dan
`benih_animasi` yang sama — dua angka itulah yang membuat kedua roda berhenti
di segmen yang sama.

Satu catatan yang layak disimpan: **jalannya yang pertama gagal**, siaran tidak
datang dalam 15 detik, lalu semua jalan berikutnya lulus. Diagnosis terpisah
menunjukkan keempat tabel menyiarkan dengan benar. Dugaan terkuatnya layanan
Realtime belum selesai membaca ulang publikasi yang baru saja bertambah dua
tabel. Sekali di awal, tidak berulang.

- [x] **Step 4: Uji pemulihan setelah muat ulang**

Dicakup skrip yang sama: putaran terakhir dibaca ulang oleh klien ketiga yang
belum pernah tahu apa-apa soal room itu, dan hasilnya sama persis dengan yang
dipegang layar pemutar — termasuk `benih_animasi`, yang berarti sudut
berhentinya juga sama.

- [x] **Step 5: Uji kunci anti dua putaran**

Tiga penekanan yang dikirim bersamaan ternyata **selalu berbaris rapi**:
PostgREST menyelesaikan satu permintaan sebelum yang berikutnya membaca nomor
giliran, jadi masing-masing dapat nomornya sendiri — `[1,2,3]`, tidak ada yang
bertabrakan. Bagus untuk peserta, tapi tidak membuktikan apa pun soal kuncinya.

Maka tabrakannya dipaksa di dalam skrip: nomor giliran dikembalikan ke angka
yang sudah terpakai, lalu roda diputar lagi lewat jalur anon yang sama dengan
browser. Hasilnya `Someone else just spun. Here comes their question.` — bukan
galat mentah, dan bukan pertanyaan kedua. Nama batasan yang menolaknya
diperiksa terpisah di jalan yang sama.

- [x] **Step 6: Uji tampilan di produksi lewat otomasi peramban**

Dua tab pada `https://fellowship-games-seven.vercel.app/room/<kode>`:

| Yang diperiksa | Hasil |
|---|---|
| Segmen berhenti sama di dua layar | `rotate(1822.5deg)` di keduanya, lalu `rotate(4927.5deg)` setelah putaran kedua |
| Teks pertanyaan sama di dua layar | `QUESTION #2 — Who has shaped your life the most, and how?` di keduanya |
| Segmen di bawah penunjuk cocok dengan teksnya | Segmen merah muda "If you could redo…" tepat di bawah ▼ saat pertanyaannya itu |
| Muat ulang tidak memutar ulang animasi | Sudut tetap `1822.5deg`, `transition-duration` `0s` |
| Putaran baru beranimasi dan maju | `transition-duration` `4s`, sudut naik 1822.5 → 4927.5 |

- [x] **Step 7: Uji, build, commit, deploy**

```bash
pnpm test && pnpm build && pnpm lint
git add -A && git commit -m "feat: komponen roda dan layar sesi putaran"
pnpm dlx vercel@latest --prod
```

---

## Definisi Selesai Potongan 3

1. `pnpm test` lulus, 49 uji, 10 berkas. `pnpm build` dan `pnpm lint` bersih.
2. Dua HP di URL produksi: satu menekan PUTAR, kedua layar berhenti di segmen yang sama dengan teks pertanyaan identik.
3. Muat ulang halaman mengembalikan pertanyaan terakhir tanpa perlu memutar lagi.
4. Dua penekanan hampir bersamaan menghasilkan tepat satu pertanyaan; yang kalah dapat pesan yang bisa dibaca, bukan layar rusak.
5. `putar_roda` dengan token ngawur ditolak.

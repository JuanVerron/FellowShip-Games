# Potongan 1 — Tulang Punggung Online: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplikasi Next.js kosong yang sudah online di Vercel, tersambung ke Supabase, dan punya cron harian yang menahan project Supabase dari dipause.

**Architecture:** Satu repo Next.js App Router. Sambungan ke Supabase dibungkus di `src/lib/supabase.ts` sebagai pabrik klien, dan logika pemeriksaan kesehatan dipisah di `src/lib/health.ts` yang menerima klien sebagai argumen — pemisahan ini yang membuatnya bisa diuji tanpa database sungguhan. Dua route handler tipis (`/api/health` untuk membaca, `/api/keep-alive` untuk menulis) menjadi permukaan HTTP-nya.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4, `@supabase/supabase-js`, Vitest 4, pnpm, Vercel Hobby.

**Spec:** `PRD.md` — khususnya bagian 8 (Design & Technical Constraints) dan bagian 10 Potongan 1.

## Global Constraints

- Nol biaya adalah syarat mati. Jangan sambungkan metode pembayaran ke Vercel; akun Hobby berhenti melayani saat limit tercapai, bukan menagih.
- Vercel Hobby hanya untuk pemakaian non-komersial.
- Supabase gratis: 500 MB database, 2 project aktif, dipause setelah 7 hari tanpa aktivitas database.
- Region Supabase: Southeast Asia (Singapore).
- Package manager: pnpm.
- Seluruh antarmuka berbahasa Indonesia, bernada percakapan.
- Target layar utama potret HP 360px. Sasaran sentuh minimal 44px.
- `service_role key` Supabase tidak boleh masuk repo, tidak boleh masuk env yang berawalan `NEXT_PUBLIC_`, dan tidak boleh ditempel ke percakapan.
- Commit sering, satu commit per task.

---

## Prasyarat Manual (dikerjakan Juan sebelum Task 1)

Task 2 dan seterusnya macet tanpa ini. Kerjakan dulu.

- [ ] **P1.** Bikin akun di [supabase.com](https://supabase.com), login pakai GitHub, buat organization paket **Free**.
- [ ] **P2.** **New project**: nama `fellowship-games`, region **Southeast Asia (Singapore)**, password database di-*generate* lalu disimpan di tempat aman. Tunggu ~2 menit sampai provisioning selesai.
- [ ] **P3.** Buka **Settings → API**, salin `Project URL` dan `anon public` key. Dua nilai ini yang dipakai di Task 1 langkah 8.
- [ ] **P4.** Bikin akun di [vercel.com](https://vercel.com), login pakai GitHub, pilih paket **Hobby**. Jangan isi metode pembayaran.

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `src/lib/supabase.ts` | Membuat klien Supabase dari variabel lingkungan, dan gagal keras kalau variabelnya kosong |
| `src/lib/health.ts` | Menerjemahkan hasil query `app_health` jadi bentuk hasil yang jelas. Tidak tahu-menahu soal HTTP maupun cara klien dibuat |
| `src/lib/__tests__/health.test.ts` | Uji `cekKesehatan` dengan klien palsu, tanpa menyentuh database |
| `src/app/api/health/route.ts` | Permukaan HTTP untuk membaca kesehatan. Tipis: rakit klien, panggil `cekKesehatan`, terjemahkan ke kode status |
| `src/app/api/keep-alive/route.ts` | Permukaan HTTP untuk **menulis** ke database. Dipanggil cron harian; menulis, bukan membaca, karena yang dihitung Supabase sebagai aktivitas adalah perubahan data |
| `src/app/page.tsx` | Halaman depan sementara dengan satu tombol uji koneksi |
| `supabase/migrations/0001_app_health.sql` | Skema tabel `app_health`, kebijakan RLS, dan fungsi `sentuh_kesehatan` |
| `vercel.json` | Jadwal cron harian |
| `vitest.config.mts` | Konfigurasi pelari uji |
| `.env.example` | Daftar nama variabel lingkungan yang dibutuhkan, tanpa nilainya |

`health.ts` sengaja menerima `SupabaseClient` sebagai argumen alih-alih membuatnya sendiri. Itulah yang membuat pengujiannya tidak perlu database, dan pola ini akan dipakai ulang di semua modul domain di potongan berikutnya.

---

### Task 1: Kerangka project dan perkakas uji

**Files:**
- Create: seluruh kerangka Next.js di akar project
- Create: `vitest.config.mts`
- Create: `src/lib/__tests__/sanity.test.ts`
- Create: `.env.local`, `.env.example`
- Modify: `package.json` (tambah script `test`)

**Interfaces:**
- Consumes: —
- Produces: perintah `pnpm test` yang jalan; alias impor `@/*` menunjuk ke `src/`

- [x] **Step 1: Tulis uji kewarasan lebih dulu**

Buat `src/lib/__tests__/sanity.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'

describe('perkakas uji', () => {
  it('menjalankan berkas uji di dalam src', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [x] **Step 2: Jalankan dan pastikan gagal**

Run: `pnpm test`
Expected: GAGAL — `pnpm` belum mengenal script `test` dan vitest belum terpasang.

- [x] **Step 3: Bangun kerangka Next.js di subfolder sementara**

Direktori ini sudah berisi `PRD.md`, `CLAUDE.md`, dan `docs/`, dan `create-next-app` menolak menulis ke folder yang berisi berkas asing. Jadi bangun di subfolder dulu, baru dipindah.

```bash
pnpm create next-app@latest scaffold-tmp --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --skip-install --yes
```

Nama subfoldernya **tidak boleh berawalan garis bawah** — `create-next-app` memakainya sebagai nama paket npm dan npm menolak nama yang diawali `_`. `--skip-install` dipakai supaya `node_modules` tidak ikut dipindah; pemasangan dilakukan sekali di akar setelah pemindahan. `--yes` melewati pertanyaan interaktif.

- [x] **Step 4: Pindahkan isi kerangka ke akar project**

```bash
rm -rf scaffold-tmp/.git scaffold-tmp/AGENTS.md scaffold-tmp/CLAUDE.md scaffold-tmp/README.md
cp -r scaffold-tmp/. .
rm -rf scaffold-tmp
```

Tiga hal yang menentukan di sini, dan ketiganya merusak kalau dilewatkan:

- **`CLAUDE.md` bawaan kerangka wajib dibuang lebih dulu.** Next.js 16 ikut menulis `CLAUDE.md` sebaris berisi `@AGENTS.md`. Kalau ikut tersalin, `CLAUDE.md` project — seluruh keputusan yang tidak boleh diubah diam-diam — tertimpa tanpa peringatan.
- **`AGENTS.md` dibuang karena `CLAUDE.md` sudah mengisi perannya.** Perlu diketahui: `next dev` menulis ulang berkas ini tiap kali dijalankan. Kalau muncul lagi, biarkan dan ikut commit — isinya cuma penunjuk ke dokumentasi Next.js dan tidak bertabrakan dengan aturan project.
- **Pakai `cp -r scaffold-tmp/. .`, bukan `mv`.** Uji kewarasan dari Step 1 sudah membuat `src/` ada di akar, dan `mv scaffold-tmp/src .` akan menaruhnya jadi `src/src` alih-alih menyatu. Bentuk `cp -r <dir>/. .` menggabungkan isi direktori yang sudah ada, sekaligus ikut membawa berkas tersembunyi seperti `.gitignore`.

Lalu samakan nama paket dengan nama project:

```bash
node -e "const p=require('./package.json');p.name='fellowship-games';require('fs').writeFileSync('package.json',JSON.stringify(p,null,2))"
```

- [x] **Step 5: Pasang dependensi, termasuk perkakas uji**

```bash
pnpm install
pnpm add @supabase/supabase-js
pnpm add -D vitest
```

- [x] **Step 6: Konfigurasi Vitest**

Buat `vitest.config.mts`:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

Dua hal yang berbeda dari tebakan awal rencana ini. Ekstensinya `.mts`, bukan `.ts`, karena Vite 7 memuat konfigurasi `.ts` sebagai CommonJS dan memperingatkan tiap kali uji dijalankan. Dan alias `@/*` tidak lagi butuh paket `vite-tsconfig-paths` — Vite sudah membacanya sendiri dari `tsconfig.json` lewat `resolve.tsconfigPaths: true`. Satu dependensi lebih sedikit, dan keluaran uji jadi bersih tanpa peringatan.

Tambahkan script di `package.json`, di dalam blok `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [x] **Step 7: Jalankan uji dan pastikan lulus**

Run: `pnpm test`
Expected: LULUS — 1 berkas uji, 1 uji, tanpa peringatan.

- [x] **Step 8: Siapkan variabel lingkungan**

Buat `.env.example` (masuk repo, tanpa nilai):

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Buat `.env.local` (tidak masuk repo) dan isi dengan dua nilai dari langkah P3:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Kalau prasyarat P1–P3 belum dikerjakan, tetap buat `.env.local` dengan kedua nilai **dibiarkan kosong**. Kosong lebih baik daripada diisi nilai contoh: `buatKlienSupabase` di Task 3 sengaja gagal keras saat variabelnya kosong dan menyebut nama variabel yang kurang, sedangkan nilai contoh yang ngawur baru gagal jauh di dalam sebagai galat jaringan yang tidak menjelaskan apa-apa.

- [x] **Step 9: Pastikan `.env.local` diabaikan git dan `.env.example` tidak**

`.gitignore` bawaan Next.js memuat pola `.env*`, dan pola itu ikut menelan `.env.example` yang justru harus masuk repo. Tambahkan pengecualiannya tepat di bawah baris `.env*`:

```
.env*
!.env.example
```

Run: `git init && git add -A && git status --short | grep -c ".env.local"`
Expected: `0`.

Run: `git status --short | grep ".env.example"`
Expected: satu baris berawalan `A`. Kalau kosong, pengecualian di atas belum kena.

- [x] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: kerangka Next.js, Tailwind, dan Vitest"
```

---

### Task 2: Skema `app_health` di Supabase

**Files:**
- Create: `supabase/migrations/0001_app_health.sql`

**Interfaces:**
- Consumes: project Supabase dari langkah P2
- Produces: tabel `public.app_health` (satu baris, `id = 1`, kolom `disentuh_pada timestamptz`) yang boleh dibaca `anon`; fungsi `public.sentuh_kesehatan()` yang boleh dijalankan `anon` dan mengembalikan `timestamptz`

- [x] **Step 1: Tulis berkas migrasi**

Buat `supabase/migrations/0001_app_health.sql`:

```sql
create table if not exists public.app_health (
  id smallint primary key default 1,
  disentuh_pada timestamptz not null default now(),
  constraint app_health_baris_tunggal check (id = 1)
);

insert into public.app_health (id) values (1)
  on conflict (id) do nothing;

alter table public.app_health enable row level security;

drop policy if exists "app_health boleh dibaca siapa saja" on public.app_health;
create policy "app_health boleh dibaca siapa saja"
  on public.app_health
  for select
  using (true);

create or replace function public.sentuh_kesehatan()
returns timestamptz
language sql
security definer
set search_path = public
as $$
  update public.app_health
     set disentuh_pada = now()
   where id = 1
  returning disentuh_pada;
$$;

grant execute on function public.sentuh_kesehatan() to anon;
```

Catatan yang perlu dipahami sebelum menerapkan: RLS hanya membuka **baca**. Menulis tidak dibuka ke `anon` sama sekali; satu-satunya jalan menulis adalah lewat fungsi `sentuh_kesehatan` yang berjalan `security definer`. Pola inilah yang dipakai untuk semua penulisan di potongan-potongan berikutnya, jadi pahami sekarang, bukan nanti.

- [ ] **Step 2: Terapkan ke Supabase**

Buka dashboard Supabase → **SQL Editor** → **New query** → tempel seluruh isi berkas → **Run**.
Expected: `Success. No rows returned`.

- [ ] **Step 3: Verifikasi tabelnya berisi**

Di SQL Editor jalankan:

```sql
select * from public.app_health;
```

Expected: tepat satu baris, `id = 1`, `disentuh_pada` berisi waktu.

- [ ] **Step 4: Verifikasi fungsinya bisa dipanggil**

Di SQL Editor jalankan:

```sql
select public.sentuh_kesehatan();
```

Expected: satu nilai waktu, dan lebih baru dari nilai di Step 3.

- [x] **Step 5: Commit**

```bash
git add supabase/migrations/0001_app_health.sql
git commit -m "feat: tabel app_health dan fungsi sentuh_kesehatan"
```

---

### Task 3: Klien Supabase dan pemeriksa kesehatan

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `src/lib/health.ts`
- Test: `src/lib/__tests__/health.test.ts`

**Interfaces:**
- Consumes: tabel `app_health` dari Task 2; variabel `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` dari Task 1
- Produces:
  - `buatKlienSupabase(): SupabaseClient`
  - `type HasilKesehatan = { sehat: true; disentuhPada: string } | { sehat: false; alasan: string }`
  - `cekKesehatan(klien: SupabaseClient): Promise<HasilKesehatan>`

- [x] **Step 1: Tulis uji yang gagal**

Buat `src/lib/__tests__/health.test.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { cekKesehatan } from '@/lib/health'

function klienPalsu(hasil: { data: unknown; error: unknown }): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => hasil,
        }),
      }),
    }),
  } as unknown as SupabaseClient
}

describe('cekKesehatan', () => {
  it('melaporkan sehat saat barisnya ditemukan', async () => {
    const klien = klienPalsu({
      data: { disentuh_pada: '2026-08-28T02:00:00.000Z' },
      error: null,
    })

    expect(await cekKesehatan(klien)).toEqual({
      sehat: true,
      disentuhPada: '2026-08-28T02:00:00.000Z',
    })
  })

  it('melaporkan tidak sehat dan meneruskan pesan saat database gagal', async () => {
    const klien = klienPalsu({ data: null, error: { message: 'koneksi gagal' } })

    expect(await cekKesehatan(klien)).toEqual({
      sehat: false,
      alasan: 'koneksi gagal',
    })
  })

  it('melaporkan tidak sehat saat barisnya tidak ada', async () => {
    const klien = klienPalsu({ data: null, error: null })

    expect(await cekKesehatan(klien)).toEqual({
      sehat: false,
      alasan: 'baris app_health tidak ditemukan',
    })
  })
})
```

Uji ketiga ada karena kasusnya nyata dan diam: migrasi berhasil dijalankan tapi baris `insert` gagal, sehingga query lolos tanpa error tapi tidak mengembalikan apa-apa. Tanpa uji ini, keadaan itu tampil sebagai "sehat".

- [x] **Step 2: Jalankan uji dan pastikan gagal**

Run: `pnpm test`
Expected: GAGAL — `Cannot find module '@/lib/health'`.

- [x] **Step 3: Tulis pabrik klien**

Buat `src/lib/supabase.ts`:

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function buatKlienSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY wajib diisi',
    )
  }

  return createClient(url, anonKey)
}
```

Gagal keras saat variabelnya kosong itu disengaja. Kalau dibiarkan lewat, kegagalannya baru muncul sebagai error jaringan yang membingungkan jauh di dalam aplikasi.

- [x] **Step 4: Tulis implementasi minimal pemeriksa kesehatan**

Buat `src/lib/health.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

export type HasilKesehatan =
  | { sehat: true; disentuhPada: string }
  | { sehat: false; alasan: string }

export async function cekKesehatan(
  klien: SupabaseClient,
): Promise<HasilKesehatan> {
  const { data, error } = await klien
    .from('app_health')
    .select('disentuh_pada')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    return { sehat: false, alasan: error.message }
  }

  if (!data) {
    return { sehat: false, alasan: 'baris app_health tidak ditemukan' }
  }

  return { sehat: true, disentuhPada: (data as { disentuh_pada: string }).disentuh_pada }
}
```

- [x] **Step 5: Jalankan uji dan pastikan lulus**

Run: `pnpm test`
Expected: LULUS — 2 berkas uji, 4 uji.

- [x] **Step 6: Commit**

```bash
git add src/lib
git commit -m "feat: klien Supabase dan pemeriksa kesehatan"
```

---

### Task 4: Permukaan HTTP dan halaman uji koneksi

**Files:**
- Create: `src/app/api/health/route.ts`
- Create: `src/app/api/keep-alive/route.ts`
- Modify: `src/app/page.tsx` (ganti seluruh isinya)

**Interfaces:**
- Consumes: `buatKlienSupabase`, `cekKesehatan`, `HasilKesehatan` dari Task 3; fungsi `sentuh_kesehatan` dari Task 2
- Produces: `GET /api/health` mengembalikan JSON `HasilKesehatan` dengan status 200 saat sehat dan 503 saat tidak; `GET /api/keep-alive` mengembalikan `{ ok: boolean }`

- [x] **Step 1: Buat route pembaca kesehatan**

Buat `src/app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { cekKesehatan } from '@/lib/health'
import { buatKlienSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const hasil = await cekKesehatan(buatKlienSupabase())
    return NextResponse.json(hasil, { status: hasil.sehat ? 200 : 503 })
  } catch (galat) {
    const alasan = galat instanceof Error ? galat.message : 'galat tidak dikenal'
    return NextResponse.json({ sehat: false, alasan }, { status: 503 })
  }
}
```

- [x] **Step 2: Buat route penulis untuk cron**

Buat `src/app/api/keep-alive/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { buatKlienSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await buatKlienSupabase().rpc('sentuh_kesehatan')

    if (error) {
      return NextResponse.json({ ok: false, alasan: error.message }, { status: 503 })
    }

    return NextResponse.json({ ok: true, disentuhPada: data })
  } catch (galat) {
    const alasan = galat instanceof Error ? galat.message : 'galat tidak dikenal'
    return NextResponse.json({ ok: false, alasan }, { status: 503 })
  }
}
```

Route ini **menulis**, bukan membaca. Supabase menghitung perubahan data sebagai aktivitas; permintaan baca saja belum tentu menahan project dari dipause. Ini alasan `/api/health` dan `/api/keep-alive` sengaja dipisah alih-alih dijadikan satu.

- [x] **Step 3: Ganti halaman depan dengan tombol uji**

Ganti seluruh isi `src/app/page.tsx`:

```tsx
'use client'

import { useState } from 'react'

type Keadaan =
  | { jenis: 'diam' }
  | { jenis: 'memuat' }
  | { jenis: 'selesai'; pesan: string; sehat: boolean }

export default function Beranda() {
  const [keadaan, setKeadaan] = useState<Keadaan>({ jenis: 'diam' })

  async function ujiKoneksi() {
    setKeadaan({ jenis: 'memuat' })
    try {
      const tanggapan = await fetch('/api/health')
      const isi = await tanggapan.json()
      setKeadaan({
        jenis: 'selesai',
        sehat: isi.sehat === true,
        pesan: isi.sehat
          ? `Tersambung. Terakhir disentuh ${isi.disentuhPada}`
          : `Gagal: ${isi.alasan}`,
      })
    } catch {
      setKeadaan({ jenis: 'selesai', sehat: false, pesan: 'Gagal menghubungi server' })
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Fellowship Games</h1>
        <p className="mt-2 text-sm opacity-70">
          Belum ada apa-apa di sini. Halaman ini cuma membuktikan aplikasinya hidup
          dan tersambung ke database.
        </p>
      </div>

      <button
        type="button"
        onClick={ujiKoneksi}
        disabled={keadaan.jenis === 'memuat'}
        className="min-h-[44px] rounded-lg bg-black px-4 py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {keadaan.jenis === 'memuat' ? 'Menguji…' : 'Uji koneksi database'}
      </button>

      {keadaan.jenis === 'selesai' && (
        <p
          role="status"
          className={`text-sm ${keadaan.sehat ? 'text-green-600' : 'text-red-600'}`}
        >
          {keadaan.pesan}
        </p>
      )}
    </main>
  )
}
```

- [ ] **Step 4: Uji di browser**

Run: `pnpm dev`
Buka `http://localhost:3000`, tekan **Uji koneksi database**.
Expected: teks hijau "Tersambung. Terakhir disentuh …" dengan waktu dari Task 2.

Kalau merah dan berbunyi "wajib diisi", `.env.local` belum terbaca — hentikan `pnpm dev` dan jalankan ulang, karena Next.js hanya membaca berkas env saat start.

- [ ] **Step 5: Uji route cron secara manual**

Buka `http://localhost:3000/api/keep-alive` di browser.
Expected: JSON `{"ok":true,"disentuhPada":"…"}` dengan waktu yang **lebih baru** dari yang muncul di Step 4. Tekan tombol uji koneksi lagi untuk memastikan waktunya memang bergerak.

- [x] **Step 6: Pastikan uji otomatis masih lulus**

Run: `pnpm test`
Expected: LULUS — 2 berkas uji, 4 uji.

- [x] **Step 7: Commit**

```bash
git add src/app
git commit -m "feat: route health dan keep-alive, halaman uji koneksi"
```

---

### Task 5: Deploy ke Vercel dan cron anti-pause

**Files:**
- Create: `vercel.json`

**Interfaces:**
- Consumes: `GET /api/keep-alive` dari Task 4
- Produces: URL publik `https://<nama>.vercel.app` yang bisa dibuka dari HP

- [x] **Step 1: Tulis jadwal cron**

Buat `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/keep-alive",
      "schedule": "0 3 * * *"
    }
  ]
}
```

Paket Hobby membatasi cron ke sekali sehari, dan sekali sehari sudah jauh lebih rapat dari ambang pause Supabase yang 7 hari. `0 3 * * *` berarti pukul 03.00 UTC, yaitu 10.00 WIB — sengaja di jam yang tidak bertabrakan dengan waktu fellowship.

- [x] **Step 2: Commit sebelum deploy**

```bash
git add vercel.json
git commit -m "chore: jadwal cron harian penahan pause Supabase"
```

- [ ] **Step 3: Masuk ke Vercel dari terminal**

Run: `pnpm dlx vercel@latest login`
Ikuti tautan yang muncul dan setujui di browser.

- [ ] **Step 4: Hubungkan folder ini ke sebuah project Vercel**

Run: `pnpm dlx vercel@latest link`
Jawab: buat project baru, nama `fellowship-games`, direktori root `./`.

- [ ] **Step 5: Daftarkan variabel lingkungan di Vercel**

```bash
pnpm dlx vercel@latest env add NEXT_PUBLIC_SUPABASE_URL production
pnpm dlx vercel@latest env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
```

Tempel nilai yang sama dengan `.env.local` saat diminta. Ulangi untuk lingkungan `preview` kalau ingin pratinjau ikut jalan.

- [ ] **Step 6: Deploy ke produksi**

Run: `pnpm dlx vercel@latest --prod`
Expected: keluar URL `https://fellowship-games-….vercel.app`.

- [ ] **Step 7: Uji dari HP sungguhan**

Buka URL itu di browser HP, tekan **Uji koneksi database**.
Expected: teks hijau "Tersambung…". Ini bukti Potongan 1 selesai — bukan lulusnya uji di laptop.

- [ ] **Step 8: Verifikasi cron terdaftar**

Buka dashboard Vercel → project `fellowship-games` → tab **Cron Jobs**.
Expected: satu entri `/api/keep-alive`, jadwal `0 3 * * *`, berstatus aktif.

- [ ] **Step 9: Commit berkas konfigurasi Vercel**

```bash
git add .vercel .gitignore
git commit -m "chore: tautkan project ke Vercel"
```

Kalau `.vercel` sudah masuk `.gitignore` bawaan, lewati saja — memang tidak perlu dilacak.

---

---

## Status: berhenti di depan prasyarat manual — 2026-08-28

Semua yang bisa dikerjakan tanpa akun Supabase dan Vercel sudah selesai dan ter-commit. Lima commit, `pnpm test` lulus 4 uji, `pnpm build` lulus, `pnpm lint` dan `tsc --noEmit` bersih.

**Sudah terbukti jalan tanpa kredensial.** Server produksi dijalankan lokal lalu ketiga permukaannya diketuk:

| Permukaan | Hasil |
|---|---|
| `GET /` | 200, merender judul dan tombol `min-h-[44px]` |
| `GET /api/health` | 503 `{"sehat":false,"alasan":"NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY wajib diisi"}` |
| `GET /api/keep-alive` | 503, pesan sama |

Dua 503 itu bukan kegagalan, melainkan jalur gagal-keras dari Task 3 Step 3 yang bekerja persis seperti rancangannya: menyebut nama variabel yang kurang, bukan galat jaringan yang membingungkan. Begitu `.env.local` diisi, keduanya berbalik jadi 200 tanpa perubahan kode.

**Yang masih tertahan, berikut pemicunya.** Semuanya menunggu prasyarat P1–P4, tidak ada yang menunggu kode:

- **Task 2 Step 2–4** — terapkan `supabase/migrations/0001_app_health.sql` lewat SQL Editor, lalu verifikasi barisnya ada dan `sentuh_kesehatan()` memajukan waktunya. Butuh P1–P2.
- **Task 1 Step 8** — isi dua nilai kosong di `.env.local` dari Settings → API. Butuh P3.
- **Task 4 Step 4–5** — uji tombol di `pnpm dev` dan pastikan `/api/keep-alive` memajukan waktunya. Butuh dua butir di atas.
- **Task 5 Step 3–9** — login, link, daftarkan env, deploy, uji dari HP, verifikasi cron terdaftar. Butuh P4.

Urutannya mengikat: P1–P3 dan Task 2 harus lebih dulu, karena deploy yang env-nya belum benar hanya memindahkan galat yang sama ke internet.

## Definisi Selesai Potongan 1

Semua harus benar, bukan sebagian:

1. `pnpm test` lulus, 4 uji.
2. URL `*.vercel.app` dibuka dari HP dan tombol uji koneksi menyala hijau.
3. `/api/keep-alive` mengembalikan `{"ok":true}` dan waktunya bergerak tiap dipanggil.
4. Cron `/api/keep-alive` terdaftar aktif di dashboard Vercel.
5. Tidak ada metode pembayaran tersambung di Vercel maupun Supabase.

Setelah kelimanya terpenuhi, rencana untuk Potongan 2 baru ditulis.

---

## Catatan Perubahan terhadap PRD

**2026-08-28 — Cron anti-pause pindah dari GitHub Actions ke Vercel Cron.**
PRD bagian 8 dan Build Order Potongan 1 menyebut jadwal GitHub Actions mingguan. Rencana ini memakai Vercel Cron harian.
**Alasan:** GitHub Actions menuntut repo GitHub sudah ada, berikut penyimpanan rahasia terpisah, padahal deploy pertama bisa jalan lewat `vercel` CLI langsung dari lokal tanpa GitHub sama sekali. Vercel Cron cuma butuh empat baris di `vercel.json` dan memakai variabel lingkungan yang sudah didaftarkan. Satu layanan lebih sedikit untuk disiapkan di hari pertama, dan frekuensinya justru naik dari mingguan jadi harian.

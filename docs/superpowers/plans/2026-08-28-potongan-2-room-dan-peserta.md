# Potongan 2 — Room Hidup Berisi Orang: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Siapa pun bisa membuat room dan mendapat kode; orang lain masuk lewat kode dan nama; daftar peserta di ruang tunggu berubah langsung di semua HP tanpa dimuat ulang.

**Architecture:** Semua perubahan keadaan lewat fungsi Postgres `security definer` yang memeriksa token — browser tidak pernah menulis ke tabel secara langsung. Rahasia (token host dan token peserta) disimpan di dua tabel terpisah yang tidak punya satu pun kebijakan RLS, sehingga mustahil terbaca dari browser. Sinkronisasi memakai Supabase Realtime yang menyimak perubahan tabel `participants` dan `rooms`.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind, `@supabase/supabase-js`, Vitest, Postgres.

**Spec:** `PRD.md` bagian 4.2, 4.3, 4.5 dan Build Order Potongan 2.

**Prasyarat:** Potongan 1 selesai — semua butir "Definisi Selesai Potongan 1" terpenuhi.

## Global Constraints

- Nol biaya. Jangan tambah layanan berbayar apa pun.
- Package manager: pnpm. Uji: `pnpm test`.
- Seluruh antarmuka berbahasa Indonesia, bernada percakapan.
- Target layar utama potret HP 360px. Sasaran sentuh minimal 44px.
- Browser tidak boleh menulis langsung ke tabel. Semua penulisan lewat fungsi `security definer`.
- Token tidak boleh bisa dibaca dari browser.
- Kode room 5 karakter huruf besar, tanpa O, 0, I, 1, L.
- Nama peserta 1–20 karakter dan unik di dalam satu room.
- Satu commit per task.

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `supabase/migrations/0002_room_dan_peserta.sql` | Tabel `rooms`, `participants`, dua tabel rahasia, dan fungsi `buat_room` / `masuk_room` |
| `src/lib/kode.ts` | Merapikan dan memvalidasi kode room yang diketik orang. Murni, tanpa I/O |
| `src/lib/nama.ts` | Merapikan dan memvalidasi nama tampilan. Murni, tanpa I/O |
| `src/lib/identitas.ts` | Menyimpan dan membaca identitas peserta di localStorage, per kode room |
| `src/lib/room.ts` | Membungkus panggilan RPC ke Supabase jadi fungsi berjenis jelas |
| `src/hooks/useRoom.ts` | Berlangganan Realtime dan menyediakan keadaan room + daftar peserta ke komponen |
| `src/app/page.tsx` | Halaman depan: dua jalan, Buat Room dan Masuk Room |
| `src/app/buat/page.tsx` | Layar buat room (sementara cuma nama host) |
| `src/app/masuk/page.tsx` | Layar masuk room: kode + nama |
| `src/app/room/[kode]/page.tsx` | Ruang tunggu: kode besar dan daftar peserta yang hidup |

---

### Task 1: Skema room, peserta, dan rahasianya

**Files:**
- Create: `supabase/migrations/0002_room_dan_peserta.sql`

**Interfaces:**
- Consumes: project Supabase dari Potongan 1
- Produces:
  - Tabel `public.rooms`, `public.participants`, `public.room_secrets`, `public.participant_secrets`
  - `public.buat_room(p_nama_host text)` → `table(room_id uuid, kode text, host_token text, participant_id uuid, participant_token text)`
  - `public.masuk_room(p_kode text, p_nama text)` → `table(room_id uuid, participant_id uuid, participant_token text)`

- [x] **Step 1: Tulis berkas migrasi**

Buat `supabase/migrations/0002_room_dan_peserta.sql`:

```sql
create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique,
  status text not null default 'lobby'
    check (status in ('lobby', 'berjalan', 'selesai')),
  nomor_giliran_sekarang int not null default 0,
  opsi_buang_terpakai boolean not null default true,
  opsi_izinkan_join_telat boolean not null default true,
  dibuat_pada timestamptz not null default now(),
  kedaluwarsa_pada timestamptz not null default now() + interval '12 hours'
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  nama text not null,
  urutan_giliran int,
  adalah_host boolean not null default false,
  bergabung_pada timestamptz not null default now(),
  unique (room_id, nama)
);

create index if not exists participants_room_idx
  on public.participants(room_id);

-- Rahasia dipisah ke tabelnya sendiri. Dua tabel di bawah ini sengaja
-- TIDAK punya satu pun kebijakan RLS, sehingga anon tidak bisa membaca
-- apa-apa dari sini. Fungsi security definer tetap bisa, karena ia
-- melewati RLS.
create table if not exists public.room_secrets (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  host_token text not null
);

create table if not exists public.participant_secrets (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  token text not null
);

alter table public.rooms enable row level security;
alter table public.participants enable row level security;
alter table public.room_secrets enable row level security;
alter table public.participant_secrets enable row level security;

drop policy if exists "rooms boleh dibaca" on public.rooms;
create policy "rooms boleh dibaca" on public.rooms for select using (true);

drop policy if exists "participants boleh dibaca" on public.participants;
create policy "participants boleh dibaca" on public.participants for select using (true);

-- Pembangkit kode 5 karakter tanpa O, 0, I, 1, L supaya tidak salah
-- dengar saat disebut lisan.
create or replace function public.buat_kode_room()
returns text
language plpgsql
as $$
declare
  huruf text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  hasil text;
  i int;
begin
  loop
    hasil := '';
    for i in 1..5 loop
      hasil := hasil || substr(huruf, 1 + floor(random() * length(huruf))::int, 1);
    end loop;
    exit when not exists (select 1 from public.rooms where kode = hasil);
  end loop;
  return hasil;
end;
$$;

create or replace function public.buat_room(p_nama_host text)
returns table (
  room_id uuid,
  kode text,
  host_token text,
  participant_id uuid,
  participant_token text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room_id uuid;
  v_kode text;
  v_host_token text;
  v_participant_id uuid;
  v_participant_token text;
begin
  if p_nama_host is null or length(trim(p_nama_host)) = 0
     or length(trim(p_nama_host)) > 20 then
    raise exception 'nama tidak sah';
  end if;

  v_kode := public.buat_kode_room();
  v_host_token := encode(gen_random_bytes(24), 'hex');
  v_participant_token := encode(gen_random_bytes(24), 'hex');

  insert into public.rooms (kode) values (v_kode) returning id into v_room_id;
  insert into public.room_secrets (room_id, host_token)
    values (v_room_id, v_host_token);

  insert into public.participants (room_id, nama, adalah_host)
    values (v_room_id, trim(p_nama_host), true)
    returning id into v_participant_id;
  insert into public.participant_secrets (participant_id, token)
    values (v_participant_id, v_participant_token);

  return query select v_room_id, v_kode, v_host_token,
                      v_participant_id, v_participant_token;
end;
$$;

create or replace function public.masuk_room(p_kode text, p_nama text)
returns table (
  room_id uuid,
  participant_id uuid,
  participant_token text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room public.rooms%rowtype;
  v_participant_id uuid;
  v_token text;
begin
  if p_nama is null or length(trim(p_nama)) = 0
     or length(trim(p_nama)) > 20 then
    raise exception 'nama tidak sah';
  end if;

  select * into v_room from public.rooms
   where kode = upper(trim(p_kode)) and kedaluwarsa_pada > now();

  if not found then
    raise exception 'room tidak ditemukan';
  end if;

  if v_room.status = 'selesai' then
    raise exception 'sesi sudah selesai';
  end if;

  if v_room.status = 'berjalan' and not v_room.opsi_izinkan_join_telat then
    raise exception 'sesi sudah dimulai dan ditutup untuk peserta baru';
  end if;

  -- Kolomnya wajib diawali nama tabel. 'returns table (room_id ...)' membuat
  -- room_id jadi variabel keluaran, dan tanpa awalan ini Postgres menolak
  -- dengan 'column reference "room_id" is ambiguous'.
  if exists (select 1 from public.participants
              where participants.room_id = v_room.id
                and participants.nama = trim(p_nama)) then
    raise exception 'nama sudah dipakai di room ini';
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');

  insert into public.participants (room_id, nama)
    values (v_room.id, trim(p_nama))
    returning id into v_participant_id;
  insert into public.participant_secrets (participant_id, token)
    values (v_participant_id, v_token);

  return query select v_room.id, v_participant_id, v_token;
end;
$$;

grant execute on function public.buat_room(text) to anon;
grant execute on function public.masuk_room(text, text) to anon;

-- Idempoten: 'alter publication ... add table' melempar galat kalau tabelnya
-- sudah terdaftar, dan galat itu menggagalkan sisa eksekusi. Dibungkus
-- pemeriksaan supaya berkas ini aman dijalankan ulang berapa kali pun.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'participants'
  ) then
    alter publication supabase_realtime add table public.participants;
  end if;
end $$;
```

`set search_path = public, extensions` — bukan `public` saja. Supabase memasang `pgcrypto` ke skema `extensions`, sehingga `gen_random_bytes` tidak terlihat oleh fungsi yang search_path-nya cuma `public`; keduanya gagal saat dipanggil dengan `function gen_random_bytes(integer) does not exist`. Menambahkan `extensions` aman karena skema itu tidak bisa ditulis peran `anon`, jadi tidak membuka jalan pembajakan search_path yang justru dicegah oleh pengaturan ini.

Perhatikan `masuk_room` sudah menangani opsi `izinkan_join_telat` walau tombol untuk mengaturnya baru dibuat di Potongan 5. Aturannya ditulis sekali di tempat yang benar; yang menyusul cuma cara mengubah nilainya.

- [x] **Step 2: Terapkan ke Supabase**

Dashboard Supabase → **SQL Editor** → **New query** → tempel seluruh isi berkas → **Run**.
Expected: `Success. No rows returned`.

Dua `alter publication` di akhir berkas dibungkus pemeriksaan `pg_publication_tables`. Tanpa itu, menjalankan berkas ini dua kali melempar galat "table is already member of publication" yang **menggagalkan sisa eksekusi** — bukan sekadar peringatan yang bisa diabaikan. Dengan pembungkus itu berkasnya aman dijalankan ulang.

- [x] **Step 3: Verifikasi buat_room bekerja**

Di SQL Editor:

```sql
select * from public.buat_room('Juan');
```

Expected: satu baris berisi `room_id`, `kode` 5 huruf besar, `host_token` panjang, `participant_id`, `participant_token`.

- [x] **Step 4: Verifikasi masuk_room menolak nama kembar**

Pakai kode dari Step 3:

```sql
select * from public.masuk_room('KODE_DARI_STEP_3', 'Budi');
select * from public.masuk_room('KODE_DARI_STEP_3', 'Budi');
```

Expected: panggilan pertama berhasil, panggilan kedua gagal dengan `nama sudah dipakai di room ini`.

- [x] **Step 5: Verifikasi rahasia tidak bocor ke anon**

```sql
set role anon;
select * from public.room_secrets;
reset role;
```

Expected: nol baris. Kalau ada baris yang keluar, RLS belum aktif — jangan lanjut sebelum ini nol.

- [x] **Step 6: Commit**

```bash
git add supabase/migrations/0002_room_dan_peserta.sql
git commit -m "feat: skema room, peserta, dan fungsi buat/masuk room"
```

---

### Task 2: Modul murni untuk kode dan nama

**Files:**
- Create: `src/lib/kode.ts`
- Create: `src/lib/nama.ts`
- Test: `src/lib/__tests__/kode.test.ts`
- Test: `src/lib/__tests__/nama.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `normalisasiKode(masukan: string): string`
  - `kodeValid(kode: string): boolean`
  - `rapikanNama(masukan: string): string`
  - `namaValid(nama: string): boolean`

- [x] **Step 1: Tulis uji yang gagal**

Buat `src/lib/__tests__/kode.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { kodeValid, normalisasiKode } from '@/lib/kode'

describe('normalisasiKode', () => {
  it('menjadikan huruf besar dan membuang spasi', () => {
    expect(normalisasiKode(' ab2 cd ')).toBe('AB2CD')
  })

  it('membuang karakter selain huruf dan angka', () => {
    expect(normalisasiKode('a-b#2/c')).toBe('AB2C')
  })

  it('memotong di 5 karakter', () => {
    expect(normalisasiKode('ABCDEFGH')).toBe('ABCDE')
  })
})

describe('kodeValid', () => {
  it('menerima 5 karakter dari himpunan yang dipakai', () => {
    expect(kodeValid('AB2CD')).toBe(true)
  })

  it('menolak yang kurang dari 5 karakter', () => {
    expect(kodeValid('AB2C')).toBe(false)
  })

  it('menolak karakter yang sengaja dibuang karena mirip', () => {
    expect(kodeValid('ABOCD')).toBe(false)
    expect(kodeValid('AB1CD')).toBe(false)
  })
})
```

Buat `src/lib/__tests__/nama.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { namaValid, rapikanNama } from '@/lib/nama'

describe('rapikanNama', () => {
  it('membuang spasi di ujung dan merapatkan spasi ganda', () => {
    expect(rapikanNama('  Juan   Verron ')).toBe('Juan Verron')
  })
})

describe('namaValid', () => {
  it('menerima nama wajar', () => {
    expect(namaValid('Juan')).toBe(true)
  })

  it('menolak nama kosong', () => {
    expect(namaValid('   ')).toBe(false)
  })

  it('menolak nama lebih dari 20 karakter', () => {
    expect(namaValid('a'.repeat(21))).toBe(false)
  })
})
```

- [x] **Step 2: Jalankan uji dan pastikan gagal**

Run: `pnpm test`
Expected: GAGAL — `Cannot find module '@/lib/kode'`.

- [x] **Step 3: Tulis implementasinya**

Buat `src/lib/kode.ts`:

```typescript
export const HURUF_KODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const PANJANG_KODE = 5

export function normalisasiKode(masukan: string): string {
  return masukan
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, PANJANG_KODE)
}

export function kodeValid(kode: string): boolean {
  if (kode.length !== PANJANG_KODE) return false
  return [...kode].every((karakter) => HURUF_KODE.includes(karakter))
}
```

Buat `src/lib/nama.ts`:

```typescript
export const PANJANG_NAMA_MAKS = 20

export function rapikanNama(masukan: string): string {
  return masukan.trim().replace(/\s+/g, ' ')
}

export function namaValid(nama: string): boolean {
  const rapi = rapikanNama(nama)
  return rapi.length >= 1 && rapi.length <= PANJANG_NAMA_MAKS
}
```

- [x] **Step 4: Jalankan uji dan pastikan lulus**

Run: `pnpm test`
Expected: LULUS — 6 berkas uji, 26 uji.

Hitungan di rencana ini semula lebih rendah (4 berkas, 14 uji) karena ditulis dengan asumsi Potongan 1 berakhir di 2 berkas/4 uji. Perbaikan keamanan di akhir Potongan 1 menambahkan `cron.test.ts` dan `tanggapan.test.ts` — 2 berkas dan 12 uji. Semua angka harapan di potongan ini sudah digeser sebesar itu.

- [x] **Step 5: Commit**

```bash
git add src/lib/kode.ts src/lib/nama.ts src/lib/__tests__
git commit -m "feat: normalisasi dan validasi kode room serta nama peserta"
```

---

### Task 3: Penyimpanan identitas di browser

**Files:**
- Create: `src/lib/identitas.ts`
- Test: `src/lib/__tests__/identitas.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `type Identitas = { roomId: string; participantId: string; token: string; nama: string; hostToken: string | null }`
  - `simpanIdentitas(kode: string, identitas: Identitas, penyimpanan?: Storage): void`
  - `bacaIdentitas(kode: string, penyimpanan?: Storage): Identitas | null`
  - `hapusIdentitas(kode: string, penyimpanan?: Storage): void`

`hostToken` bernilai `null` untuk peserta biasa. Ini yang membedakan host dari peserta di seluruh aplikasi — bukan penanda boolean yang gampang dipalsukan dari konsol browser.

- [x] **Step 1: Tulis uji yang gagal**

Buat `src/lib/__tests__/identitas.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import {
  bacaIdentitas,
  hapusIdentitas,
  simpanIdentitas,
  type Identitas,
} from '@/lib/identitas'

function penyimpananPalsu(): Storage {
  const isi = new Map<string, string>()
  return {
    get length() {
      return isi.size
    },
    clear: () => isi.clear(),
    getItem: (kunci) => isi.get(kunci) ?? null,
    key: (indeks) => [...isi.keys()][indeks] ?? null,
    removeItem: (kunci) => void isi.delete(kunci),
    setItem: (kunci, nilai) => void isi.set(kunci, nilai),
  }
}

const contoh: Identitas = {
  roomId: 'r-1',
  participantId: 'p-1',
  token: 't-1',
  nama: 'Juan',
  hostToken: 'h-1',
}

describe('identitas', () => {
  let penyimpanan: Storage

  beforeEach(() => {
    penyimpanan = penyimpananPalsu()
  })

  it('mengembalikan apa yang disimpan', () => {
    simpanIdentitas('AB2CD', contoh, penyimpanan)
    expect(bacaIdentitas('AB2CD', penyimpanan)).toEqual(contoh)
  })

  it('memisahkan identitas antar room', () => {
    simpanIdentitas('AB2CD', contoh, penyimpanan)
    expect(bacaIdentitas('XY9ZQ', penyimpanan)).toBeNull()
  })

  it('mengembalikan null saat isinya rusak, bukan melempar galat', () => {
    penyimpanan.setItem('fellowship:room:AB2CD', 'bukan json')
    expect(bacaIdentitas('AB2CD', penyimpanan)).toBeNull()
  })

  it('menghapus identitas', () => {
    simpanIdentitas('AB2CD', contoh, penyimpanan)
    hapusIdentitas('AB2CD', penyimpanan)
    expect(bacaIdentitas('AB2CD', penyimpanan)).toBeNull()
  })
})
```

Uji "isinya rusak" ada karena kasusnya nyata: bentuk `Identitas` akan berubah di potongan berikutnya, dan data lama yang tersimpan di HP orang harus gagal dengan lembut — dianggap belum pernah masuk — bukan membuat halaman blank.

- [x] **Step 2: Jalankan uji dan pastikan gagal**

Run: `pnpm test`
Expected: GAGAL — `Cannot find module '@/lib/identitas'`.

- [x] **Step 3: Tulis implementasinya**

Buat `src/lib/identitas.ts`:

```typescript
export type Identitas = {
  roomId: string
  participantId: string
  token: string
  nama: string
  hostToken: string | null
}

function kunciUntuk(kode: string): string {
  return `fellowship:room:${kode}`
}

function penyimpananBawaan(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function simpanIdentitas(
  kode: string,
  identitas: Identitas,
  penyimpanan: Storage | null = penyimpananBawaan(),
): void {
  try {
    penyimpanan?.setItem(kunciUntuk(kode), JSON.stringify(identitas))
  } catch {
    // Mode penyamaran atau penyimpanan penuh. Sesi tetap boleh jalan,
    // cuma tidak bisa dipulihkan setelah halaman dimuat ulang.
  }
}

export function bacaIdentitas(
  kode: string,
  penyimpanan: Storage | null = penyimpananBawaan(),
): Identitas | null {
  try {
    const mentah = penyimpanan?.getItem(kunciUntuk(kode))
    if (!mentah) return null

    const isi = JSON.parse(mentah) as Partial<Identitas>
    if (
      typeof isi.roomId !== 'string' ||
      typeof isi.participantId !== 'string' ||
      typeof isi.token !== 'string' ||
      typeof isi.nama !== 'string'
    ) {
      return null
    }

    return {
      roomId: isi.roomId,
      participantId: isi.participantId,
      token: isi.token,
      nama: isi.nama,
      hostToken: typeof isi.hostToken === 'string' ? isi.hostToken : null,
    }
  } catch {
    return null
  }
}

export function hapusIdentitas(
  kode: string,
  penyimpanan: Storage | null = penyimpananBawaan(),
): void {
  try {
    penyimpanan?.removeItem(kunciUntuk(kode))
  } catch {
    // Sama seperti simpanIdentitas: gagal menyimpan bukan alasan
    // menghentikan sesi.
  }
}
```

- [x] **Step 4: Jalankan uji dan pastikan lulus**

Run: `pnpm test`
Expected: LULUS — 7 berkas uji, 30 uji.

- [x] **Step 5: Commit**

```bash
git add src/lib/identitas.ts src/lib/__tests__/identitas.test.ts
git commit -m "feat: penyimpanan identitas peserta per room di browser"
```

---

### Task 4: Pembungkus RPC dan langganan Realtime

**Files:**
- Create: `src/lib/room.ts`
- Create: `src/hooks/useRoom.ts`

**Interfaces:**
- Consumes: `buatKlienSupabase` (Potongan 1); `buat_room`, `masuk_room` (Task 1); `Identitas` (Task 3)
- Produces:
  - `type Room = { id: string; kode: string; status: 'lobby' | 'berjalan' | 'selesai'; nomorGiliranSekarang: number; opsiBuangTerpakai: boolean; opsiIzinkanJoinTelat: boolean }`
  - `type Peserta = { id: string; nama: string; urutanGiliran: number | null; adalahHost: boolean }`
  - `buatRoom(namaHost: string): Promise<{ kode: string; identitas: Identitas }>`
  - `masukRoom(kode: string, nama: string): Promise<Identitas>`
  - `ambilRoom(kode: string): Promise<Room | null>`
  - `ambilPeserta(roomId: string): Promise<Peserta[]>`
  - `useRoom(kode: string): { room: Room | null; peserta: Peserta[]; memuat: boolean; galat: string | null }`

- [x] **Step 1: Tulis pembungkus RPC**

Buat `src/lib/room.ts`:

```typescript
import type { Identitas } from '@/lib/identitas'
import { buatKlienSupabase } from '@/lib/supabase'

export type StatusRoom = 'lobby' | 'berjalan' | 'selesai'

export type Room = {
  id: string
  kode: string
  status: StatusRoom
  nomorGiliranSekarang: number
  opsiBuangTerpakai: boolean
  opsiIzinkanJoinTelat: boolean
}

export type Peserta = {
  id: string
  nama: string
  urutanGiliran: number | null
  adalahHost: boolean
}

type BarisRoom = {
  id: string
  kode: string
  status: StatusRoom
  nomor_giliran_sekarang: number
  opsi_buang_terpakai: boolean
  opsi_izinkan_join_telat: boolean
}

type BarisPeserta = {
  id: string
  nama: string
  urutan_giliran: number | null
  adalah_host: boolean
}

export function keRoom(baris: BarisRoom): Room {
  return {
    id: baris.id,
    kode: baris.kode,
    status: baris.status,
    nomorGiliranSekarang: baris.nomor_giliran_sekarang,
    opsiBuangTerpakai: baris.opsi_buang_terpakai,
    opsiIzinkanJoinTelat: baris.opsi_izinkan_join_telat,
  }
}

export function kePeserta(baris: BarisPeserta): Peserta {
  return {
    id: baris.id,
    nama: baris.nama,
    urutanGiliran: baris.urutan_giliran,
    adalahHost: baris.adalah_host,
  }
}

export async function buatRoom(
  namaHost: string,
): Promise<{ kode: string; identitas: Identitas }> {
  const { data, error } = await buatKlienSupabase()
    .rpc('buat_room', { p_nama_host: namaHost })
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

export async function masukRoom(kode: string, nama: string): Promise<Identitas> {
  const { data, error } = await buatKlienSupabase()
    .rpc('masuk_room', { p_kode: kode, p_nama: nama })
    .single()

  if (error) throw new Error(error.message)

  const hasil = data as {
    room_id: string
    participant_id: string
    participant_token: string
  }

  return {
    roomId: hasil.room_id,
    participantId: hasil.participant_id,
    token: hasil.participant_token,
    nama,
    hostToken: null,
  }
}

export async function ambilRoom(kode: string): Promise<Room | null> {
  const { data, error } = await buatKlienSupabase()
    .from('rooms')
    .select('id, kode, status, nomor_giliran_sekarang, opsi_buang_terpakai, opsi_izinkan_join_telat')
    .eq('kode', kode)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? keRoom(data as BarisRoom) : null
}

export async function ambilPeserta(roomId: string): Promise<Peserta[]> {
  const { data, error } = await buatKlienSupabase()
    .from('participants')
    .select('id, nama, urutan_giliran, adalah_host')
    .eq('room_id', roomId)
    .order('bergabung_pada', { ascending: true })

  if (error) throw new Error(error.message)
  return (data as BarisPeserta[]).map(kePeserta)
}
```

- [x] **Step 2: Tulis uji untuk penerjemah baris**

Buat `src/lib/__tests__/room.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { kePeserta, keRoom } from '@/lib/room'

describe('keRoom', () => {
  it('menerjemahkan nama kolom snake_case jadi camelCase', () => {
    expect(
      keRoom({
        id: 'r-1',
        kode: 'AB2CD',
        status: 'lobby',
        nomor_giliran_sekarang: 0,
        opsi_buang_terpakai: true,
        opsi_izinkan_join_telat: false,
      }),
    ).toEqual({
      id: 'r-1',
      kode: 'AB2CD',
      status: 'lobby',
      nomorGiliranSekarang: 0,
      opsiBuangTerpakai: true,
      opsiIzinkanJoinTelat: false,
    })
  })
})

describe('kePeserta', () => {
  it('mempertahankan urutan giliran yang masih kosong', () => {
    expect(
      kePeserta({ id: 'p-1', nama: 'Juan', urutan_giliran: null, adalah_host: true }),
    ).toEqual({ id: 'p-1', nama: 'Juan', urutanGiliran: null, adalahHost: true })
  })
})
```

- [x] **Step 3: Jalankan uji dan pastikan lulus**

Run: `pnpm test`
Expected: LULUS — 8 berkas uji, 32 uji.

- [x] **Step 4: Tulis hook Realtime**

Buat `src/hooks/useRoom.ts`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { ambilPeserta, ambilRoom, type Peserta, type Room } from '@/lib/room'
import { buatKlienSupabase } from '@/lib/supabase'

export function useRoom(kode: string) {
  const [room, setRoom] = useState<Room | null>(null)
  const [peserta, setPeserta] = useState<Peserta[]>([])
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
        setPeserta(r ? await ambilPeserta(r.id) : [])
        setGalat(r ? null : 'Room tidak ditemukan')
      } catch (e) {
        if (!dibatalkan) setGalat(e instanceof Error ? e.message : 'Gagal memuat room')
      } finally {
        if (!dibatalkan) setMemuat(false)
      }
    }

    void muatUlang()

    const saluran = klien
      .channel(`room:${kode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants' },
        () => void muatUlang(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        () => void muatUlang(),
      )
      .subscribe()

    return () => {
      dibatalkan = true
      void klien.removeChannel(saluran)
    }
  }, [kode])

  return { room, peserta, memuat, galat }
}
```

Setiap perubahan memicu muat ulang penuh, bukan penambalan keadaan setempat. Untuk room berisi belasan orang biayanya sepele, dan imbalannya besar: tidak ada kelas bug "layar saya beda sendiri" yang muncul saat siaran terlewat.

- [x] **Step 5: Commit**

```bash
git add src/lib/room.ts src/lib/__tests__/room.test.ts src/hooks/useRoom.ts
git commit -m "feat: pembungkus RPC room dan langganan Realtime"
```

---

### Task 5: Layar depan, buat room, masuk room, dan ruang tunggu

**Files:**
- Modify: `src/app/page.tsx` (ganti seluruh isinya)
- Create: `src/app/buat/page.tsx`
- Create: `src/app/masuk/page.tsx`
- Create: `src/app/room/[kode]/page.tsx`

**Interfaces:**
- Consumes: `buatRoom`, `masukRoom`, `useRoom` (Task 4); `normalisasiKode`, `kodeValid` (Task 2); `namaValid`, `rapikanNama` (Task 2); `simpanIdentitas`, `bacaIdentitas` (Task 3)
- Produces: rute `/`, `/buat`, `/masuk`, `/room/[kode]`

- [x] **Step 1: Ganti halaman depan**

Ganti seluruh isi `src/app/page.tsx`:

```tsx
import Link from 'next/link'

export default function Beranda() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
      <div>
        <h1 className="text-4xl font-bold">Fellowship Games</h1>
        <p className="mt-2 opacity-70">Roulette bank pertanyaan</p>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/buat"
          className="flex min-h-[52px] items-center justify-center rounded-xl bg-black px-4 font-semibold text-white dark:bg-white dark:text-black"
        >
          Buat Room
        </Link>
        <Link
          href="/masuk"
          className="flex min-h-[52px] items-center justify-center rounded-xl border-2 px-4 font-semibold"
        >
          Masuk Room
        </Link>
      </div>
    </main>
  )
}
```

- [x] **Step 2: Buat layar buat room**

Buat `src/app/buat/page.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { simpanIdentitas } from '@/lib/identitas'
import { namaValid, rapikanNama } from '@/lib/nama'
import { buatRoom } from '@/lib/room'

export default function BuatRoom() {
  const router = useRouter()
  const [nama, setNama] = useState('')
  const [mengirim, setMengirim] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  async function kirim(peristiwa: React.FormEvent) {
    peristiwa.preventDefault()
    const rapi = rapikanNama(nama)
    if (!namaValid(rapi)) {
      setGalat('Nama wajib diisi, maksimal 20 karakter.')
      return
    }

    setMengirim(true)
    setGalat(null)
    try {
      const { kode, identitas } = await buatRoom(rapi)
      simpanIdentitas(kode, identitas)
      router.push(`/room/${kode}`)
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal membuat room')
      setMengirim(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Buat Room</h1>

      <form onSubmit={kirim} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm opacity-70">Nama kamu</span>
          <input
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            maxLength={20}
            autoFocus
            className="min-h-[48px] rounded-lg border-2 px-3 text-lg"
          />
        </label>

        {galat && <p className="text-sm text-red-600">{galat}</p>}

        <button
          type="submit"
          disabled={mengirim}
          className="min-h-[52px] rounded-xl bg-black font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {mengirim ? 'Membuat…' : 'Buat'}
        </button>
      </form>
    </main>
  )
}
```

- [x] **Step 3: Buat layar masuk room**

Buat `src/app/masuk/page.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { simpanIdentitas } from '@/lib/identitas'
import { kodeValid, normalisasiKode } from '@/lib/kode'
import { namaValid, rapikanNama } from '@/lib/nama'
import { masukRoom } from '@/lib/room'

export default function MasukRoom() {
  const router = useRouter()
  const [kode, setKode] = useState('')
  const [nama, setNama] = useState('')
  const [mengirim, setMengirim] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  async function kirim(peristiwa: React.FormEvent) {
    peristiwa.preventDefault()

    if (!kodeValid(kode)) {
      setGalat('Kode room terdiri dari 5 karakter.')
      return
    }
    const rapi = rapikanNama(nama)
    if (!namaValid(rapi)) {
      setGalat('Nama wajib diisi, maksimal 20 karakter.')
      return
    }

    setMengirim(true)
    setGalat(null)
    try {
      const identitas = await masukRoom(kode, rapi)
      simpanIdentitas(kode, identitas)
      router.push(`/room/${kode}`)
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal masuk room')
      setMengirim(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Masuk Room</h1>

      <form onSubmit={kirim} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm opacity-70">Kode room</span>
          <input
            value={kode}
            onChange={(e) => setKode(normalisasiKode(e.target.value))}
            autoCapitalize="characters"
            autoFocus
            className="min-h-[56px] rounded-lg border-2 px-3 text-center font-mono text-3xl tracking-[0.3em]"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm opacity-70">Nama kamu</span>
          <input
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            maxLength={20}
            className="min-h-[48px] rounded-lg border-2 px-3 text-lg"
          />
        </label>

        {galat && <p className="text-sm text-red-600">{galat}</p>}

        <button
          type="submit"
          disabled={mengirim}
          className="min-h-[52px] rounded-xl bg-black font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {mengirim ? 'Masuk…' : 'Masuk'}
        </button>
      </form>
    </main>
  )
}
```

- [x] **Step 4: Buat ruang tunggu**

Buat `src/app/room/[kode]/page.tsx`:

```tsx
'use client'

import { use } from 'react'
import { useRoom } from '@/hooks/useRoom'

export default function RuangTunggu({
  params,
}: {
  params: Promise<{ kode: string }>
}) {
  const { kode } = use(params)
  const { room, peserta, memuat, galat } = useRoom(kode.toUpperCase())

  if (memuat) {
    return <main className="p-6">Memuat…</main>
  }

  if (galat || !room) {
    return (
      <main className="mx-auto max-w-md p-6">
        <p className="text-red-600">{galat ?? 'Room tidak ditemukan'}</p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 p-6">
      <div className="text-center">
        <p className="text-sm opacity-70">Kode room</p>
        <p className="font-mono text-5xl font-bold tracking-[0.3em]">{room.kode}</p>
        <p className="mt-2 text-sm opacity-70">Sebutkan kode ini ke teman-teman</p>
      </div>

      <div>
        <h2 className="mb-3 font-semibold">
          Peserta ({peserta.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {peserta.map((orang) => (
            <li
              key={orang.id}
              className="flex min-h-[44px] items-center justify-between rounded-lg border px-3"
            >
              <span>{orang.nama}</span>
              {orang.adalahHost && (
                <span className="text-xs opacity-60">host</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
```

- [x] **Step 5: Uji dua peramban sekaligus**

Run: `pnpm dev`

1. Jendela biasa: buka `http://localhost:3000` → Buat Room → nama "Juan" → catat kodenya.
2. Jendela penyamaran: buka alamat yang sama → Masuk Room → tempel kode → nama "Budi".
3. Lihat jendela pertama **tanpa menyentuh apa pun**.

Expected: "Budi" muncul di daftar peserta jendela pertama dalam beberapa detik, tanpa dimuat ulang. Penghitung berubah jadi `Peserta (2)`.

Kalau tidak muncul: buka konsol browser dan cari galat langganan. Penyebab paling sering adalah `alter publication supabase_realtime add table` di Task 1 yang belum benar-benar jalan — periksa di Supabase → **Database → Replication**.

Ini benar-benar terjadi saat potongan ini dikerjakan, dan gejalanya menipu: status langganan **`SUBSCRIBED`**, tidak ada galat apa pun di konsol, tapi tidak satu peristiwa pun sampai. Cara memisahkan sebabnya dengan cepat: berlangganan `broadcast` di project yang sama. Kalau broadcast sampai, transport dan otentikasi sehat dan masalahnya pasti di sisi replikasi tabel — bukan di kunci, jaringan, atau kode hook.

Satu jebakan lagi saat memverifikasi perbaikannya. Peristiwa pertama yang muncul setelah publikasi dibetulkan bisa berupa **tunggakan WAL** — perubahan lama yang baru terurai, bukan pengiriman langsung. Uji yang menerima peristiwa apa pun akan lolos secara palsu. Uji yang benar hanya menerima peristiwa untuk baris yang dibuat **setelah** langganan aktif, misalnya dengan nama peserta yang mengandung stempel waktu.

- [x] **Step 6: Uji penolakan nama kembar**

Di jendela penyamaran kedua, masuk ke kode yang sama dengan nama "Budi".
Expected: pesan merah `nama sudah dipakai di room ini`, dan tidak berpindah halaman.

- [x] **Step 7: Pastikan uji otomatis masih lulus dan build bersih**

Run: `pnpm test && pnpm build`
Expected: uji LULUS, build tanpa galat TypeScript.

- [x] **Step 8: Commit dan deploy**

```bash
git add src/app
git commit -m "feat: layar buat room, masuk room, dan ruang tunggu"
pnpm dlx vercel@latest --prod
```

- [ ] **Step 9: Uji dari dua HP sungguhan**

Buka URL produksi dari dua HP berbeda, buat room di satu HP dan masuk dari HP lain.
Expected: nama peserta kedua muncul di HP pertama tanpa disentuh.

---

---

## Status: sinkronisasi terbukti di produksi — 2026-08-28

Semua task selesai. Tersisa satu butir yang memang tidak bisa diwakilkan: **Task 5 Step 9, uji dari dua HP sungguhan**.

**Bukti dari produksi**, bukan dari laptop. Halaman ruang tunggu `https://fellowship-games-seven.vercel.app/room/NRRZ5` dibuka di browser, lalu peserta ditambahkan dari klien terpisah tanpa menyentuh halaman itu:

| Saat | Isi halaman |
|---|---|
| Sebelum | `Peserta (1)` — UjiProduksi, host |
| Sesudah peserta lain masuk | `Peserta (2)` — UjiProduksi (host), DariHPLain |

Halaman berubah **tanpa dimuat ulang**. Itu inti Potongan 2.

Verifikasi lain yang menopang: 16 pemeriksaan RPC lulus (kode 5 karakter tanpa huruf rancu, dua token 48-hex berbeda, lima penolakan dengan pesan tepat, dan `room_secrets` serta `participant_secrets` mengembalikan nol baris ke `anon`); peristiwa `postgres_changes` untuk peserta yang dibuat setelah langganan aktif sampai dalam 592 ms; 8 berkas uji / 32 uji lulus; `tsc`, `lint`, dan `build` bersih.

**Di luar rencana, sudah dikerjakan:** `src/app/layout.tsx` masih membawa `title: "Create Next App"` dan `lang="en"` dari kerangka. Judulnya terlihat peserta di tab HP, dan `lang` yang keliru membuat pembaca layar salah melafalkan sekaligus memancing tawaran terjemahan otomatis di ponsel — padahal `CLAUDE.md` mensyaratkan seluruh antarmuka berbahasa Indonesia. Keduanya diperbaiki.

---

## Tambahan di luar rencana, atas permintaan Juan — 2026-08-28

Tiga hal berikut tidak ada di rencana asli. Dua di antaranya menambal cacat nyata yang baru kelihatan saat dipakai di HP sungguhan.

**1. Satu browser satu identitas per room, dan host tetap host.**
Sebelumnya tiap kali masuk selalu dibuat peserta **baru**. Masuk dua kali ke room yang sama dari HP yang sama membuat identitas kedua menimpa yang pertama di `localStorage` — berikut `host_token`-nya. Host kehilangan status host tanpa tanda apa pun, dan mulai Potongan 4 itu berarti kehilangan tombol Mulai dan Giliran Berikutnya.

Layar Masuk kini memeriksa identitas tersimpan untuk kode itu lebih dulu. Kalau ada, kolom nama disembunyikan dan tombolnya berbunyi "Lanjutkan sebagai <nama>". Room lain tetap bisa dimasuki, karena identitas disimpan **per kode room**, bukan per browser. Karena `host_token` ikut tersimpan, host yang menutup browser lalu kembali tetap host — tanpa akun, tanpa login.

`identitasMasihSah()` membuang identitas yang menunjuk peserta yang sudah tidak ada, supaya orangnya tidak terjebak di room yang menganggapnya bukan siapa-siapa.

**Batas yang harus disadari:** penanda kepemilikan ini hidup di `localStorage`. Hapus data browser, ganti browser, atau buka dari perangkat lain, dan identitasnya hilang selamanya — tidak ada akun untuk memulihkannya. Itu konsekuensi langsung dari keputusan "tanpa login" di `CLAUDE.md`, bukan cacat yang bisa ditambal tanpa mencabut keputusan itu.

**2. Penunjuk status realtime di kaki halaman.**
Titik hijau/kuning/merah plus "diperbarui N detik lalu" yang menghitung sendiri. Alasannya ditemukan dengan cara yang mahal: saat langganan mati, layarnya **identik** dengan layar yang sehat tapi belum ada yang bergabung. Tanpa penunjuk ini tidak ada cara membedakan keduanya, dan itulah yang membuat kegagalan Realtime kemarin butuh berjam-jam untuk dipersempit.

**3. Penanda diri `(you)` menempel di nama, bingkai oranye.**
Sebelumnya tidak ada cara tahu baris mana milik sendiri. Sempat dicoba sebagai pil di tepi kanan, tapi `host` yang justru menempel tepi dan penandanya terdorong ke tengah.

## Definisi Selesai Potongan 2

1. `pnpm test` lulus, 32 uji.
2. `pnpm build` bersih.
3. Dua HP berbeda di URL produksi: buat room di satu, masuk dari satu lagi, nama muncul otomatis di layar pertama.
4. Nama kembar ditolak dengan pesan yang bisa dibaca orang, bukan layar error.
5. `select * from public.room_secrets` sebagai role `anon` mengembalikan nol baris.

---

## Catatan Risiko yang Diterima Sadar

Kebijakan RLS pada `rooms` dan `participants` adalah `using (true)`, sehingga siapa pun yang tahu alamat project Supabase bisa membaca daftar seluruh room yang aktif berikut kodenya. Artinya kode room bukan rahasia sekuat yang tersirat di PRD bagian 8.

Ini diterima untuk Fase 1 dengan tiga alasan: taruhannya rendah (pertanyaan ice breaking, bukan data pribadi), room mati sendiri dalam 12 jam, dan alternatifnya — memindahkan sinkronisasi ke Realtime Broadcast supaya tabel tidak perlu dibuka sama sekali — menambah kerumitan besar di potongan paling awal.

Kalau suatu saat room dipakai untuk hal yang lebih peka, ini butir pertama yang harus diperbaiki.

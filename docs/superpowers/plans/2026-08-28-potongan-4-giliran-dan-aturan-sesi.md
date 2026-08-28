# Potongan 4 — Giliran dan Aturan Sesi: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Urutan peserta diacak sekali saat host menekan Mulai; hanya pemilik giliran yang tombol putarnya hidup; host boleh memutar mewakili siapa pun; host yang memindahkan giliran; dan yang telat bergabung masuk ke ekor antrean.

**Architecture:** Kepemilikan giliran dihitung dari `urutan_giliran` peserta dan `nomor_giliran_sekarang` room — bukan disimpan sebagai penunjuk yang bisa basi. Penegakannya ada di dalam `putar_roda` di database; tombol yang mati di browser cuma penjelas, bukan pengaman. Kewenangan host dibuktikan dengan `host_token`, yang tidak pernah bisa dibaca dari browser siapa pun kecuali pemiliknya.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind, `@supabase/supabase-js`, Vitest, Postgres.

**Spec:** `PRD.md` bagian 4.2 (Mulai sesi), 4.3 (ekor antrean), 4.4 dan Build Order Potongan 4.

**Prasyarat:** Potongan 3 selesai — semua butir "Definisi Selesai Potongan 3" terpenuhi.

## Global Constraints

- Nol biaya. Package manager: pnpm. Uji: `pnpm test`.
- Antarmuka berbahasa Indonesia. Potret HP 360px. Sentuh minimal 44px.
- Penguncian giliran ditegakkan di database, bukan hanya dengan `disabled` di browser.
- Urutan diacak tepat sekali saat Mulai, lalu tetap sampai sesi selesai.
- Peserta yang telat bergabung menempati posisi terakhir, bukan disisipkan acak.
- Satu commit per task.

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `supabase/migrations/0004_giliran.sql` | Fungsi `mulai_sesi`, `giliran_berikutnya`, serta versi baru `putar_roda` dan `masuk_room` |
| `src/lib/giliran.ts` | Menghitung siapa pemilik giliran dan siapa yang boleh memutar. Murni, tanpa I/O |
| `src/lib/sesi.ts` | Pembungkus RPC `mulai_sesi` dan `giliran_berikutnya` |
| `src/lib/putaran.ts` | Diperluas: `putarRoda` menerima `hostToken` opsional |
| `src/app/room/[kode]/page.tsx` | Diperluas: dua tampilan (ruang tunggu dan sesi berjalan), penanda giliran, kendali host |

---

### Task 1: Fungsi giliran di database

**Files:**
- Create: `supabase/migrations/0004_giliran.sql`

**Interfaces:**
- Consumes: `rooms`, `participants`, `room_secrets`, `participant_secrets`, `spins` (Potongan 2–3)
- Produces:
  - `public.mulai_sesi(p_kode text, p_host_token text)` → `void`
  - `public.giliran_berikutnya(p_kode text, p_host_token text)` → `int` (nomor giliran yang baru)
  - `public.putar_roda(p_kode text, p_token text, p_host_token text)` — **menggantikan** versi dua argumen
  - `public.masuk_room(p_kode text, p_nama text)` — versi baru yang menaruh pendatang telat di ekor

- [ ] **Step 1: Tulis berkas migrasi**

Buat `supabase/migrations/0004_giliran.sql`:

```sql
-- Pembantu bersama: siapa pemilik giliran nomor sekian di sebuah room.
create or replace function public.pemilik_giliran(p_room_id uuid, p_nomor int)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
    from public.participants p
   where p.room_id = p_room_id and p.urutan_giliran is not null
   order by p.urutan_giliran
  offset (
    p_nomor % greatest(
      (select count(*) from public.participants
        where room_id = p_room_id and urutan_giliran is not null), 1)
  )
   limit 1;
$$;

create or replace function public.mulai_sesi(p_kode text, p_host_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
begin
  select * into v_room from public.rooms
   where kode = upper(trim(p_kode)) and kedaluwarsa_pada > now();
  if not found then
    raise exception 'room tidak ditemukan';
  end if;

  if not exists (select 1 from public.room_secrets
                  where room_id = v_room.id and host_token = p_host_token) then
    raise exception 'hanya host yang boleh memulai sesi';
  end if;

  if v_room.status <> 'lobby' then
    raise exception 'sesi sudah dimulai';
  end if;

  -- Pengacakan terjadi tepat sekali, di sini. Setelah ini urutannya tetap.
  with acak as (
    select id, (row_number() over (order by random())) - 1 as urutan
      from public.participants
     where room_id = v_room.id
  )
  update public.participants p
     set urutan_giliran = a.urutan
    from acak a
   where p.id = a.id;

  update public.rooms
     set status = 'berjalan', nomor_giliran_sekarang = 0
   where id = v_room.id;
end;
$$;

create or replace function public.giliran_berikutnya(p_kode text, p_host_token text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_baru int;
begin
  select * into v_room from public.rooms
   where kode = upper(trim(p_kode)) and kedaluwarsa_pada > now();
  if not found then
    raise exception 'room tidak ditemukan';
  end if;

  if not exists (select 1 from public.room_secrets
                  where room_id = v_room.id and host_token = p_host_token) then
    raise exception 'hanya host yang boleh memindah giliran';
  end if;

  if v_room.status <> 'berjalan' then
    raise exception 'sesi belum berjalan';
  end if;

  v_baru := v_room.nomor_giliran_sekarang + 1;
  update public.rooms set nomor_giliran_sekarang = v_baru where id = v_room.id;
  return v_baru;
end;
$$;

-- Menggantikan versi Potongan 3. Dua perubahan yang disengaja:
-- (1) kepemilikan giliran sekarang ditegakkan, (2) fungsi ini TIDAK lagi
-- menambah nomor giliran — itu jadi tugas giliran_berikutnya milik host,
-- supaya obrolan boleh melebar tanpa dikejar aplikasi.
drop function if exists public.putar_roda(text, text);

create or replace function public.putar_roda(
  p_kode text,
  p_token text,
  p_host_token text
)
returns table (
  room_question_id uuid,
  teks text,
  nomor_giliran int,
  benih_animasi int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_pemanggil uuid;
  v_pemilik uuid;
  v_adalah_host boolean := false;
  v_pertanyaan public.room_questions%rowtype;
  v_benih int;
begin
  select * into v_room from public.rooms
   where kode = upper(trim(p_kode)) and kedaluwarsa_pada > now();
  if not found then
    raise exception 'room tidak ditemukan';
  end if;

  if v_room.status <> 'berjalan' then
    raise exception 'sesi belum berjalan';
  end if;

  select p.id into v_pemanggil
    from public.participants p
    join public.participant_secrets s on s.participant_id = p.id
   where p.room_id = v_room.id and s.token = p_token;
  if not found then
    raise exception 'kamu bukan peserta room ini';
  end if;

  v_adalah_host := p_host_token is not null and exists (
    select 1 from public.room_secrets
     where room_id = v_room.id and host_token = p_host_token);

  v_pemilik := public.pemilik_giliran(v_room.id, v_room.nomor_giliran_sekarang);

  if not v_adalah_host and v_pemanggil is distinct from v_pemilik then
    raise exception 'sekarang bukan giliranmu';
  end if;

  select * into v_pertanyaan
    from public.room_questions
   where room_id = v_room.id
   order by random()
   limit 1;
  if not found then
    raise exception 'kolam pertanyaan kosong';
  end if;

  v_benih := floor(random() * 1000)::int;

  -- Batasan unik (room_id, nomor_giliran) yang menolak putaran kedua.
  insert into public.spins (
    room_id, participant_id, room_question_id, nomor_giliran, benih_animasi
  ) values (
    v_room.id, coalesce(v_pemilik, v_pemanggil), v_pertanyaan.id,
    v_room.nomor_giliran_sekarang, v_benih
  );

  update public.room_questions set sudah_keluar = true
   where id = v_pertanyaan.id;

  return query select v_pertanyaan.id, v_pertanyaan.teks,
                      v_room.nomor_giliran_sekarang, v_benih;
end;
$$;

-- Menggantikan versi Potongan 2: pendatang yang telat sekarang mendapat
-- urutan giliran di ekor, bukan dibiarkan kosong.
create or replace function public.masuk_room(p_kode text, p_nama text)
returns table (
  room_id uuid,
  participant_id uuid,
  participant_token text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_participant_id uuid;
  v_token text;
  v_urutan int;
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

  if exists (select 1 from public.participants
              where room_id = v_room.id and nama = trim(p_nama)) then
    raise exception 'nama sudah dipakai di room ini';
  end if;

  if v_room.status = 'berjalan' then
    select coalesce(max(urutan_giliran), -1) + 1 into v_urutan
      from public.participants where room_id = v_room.id;
  else
    v_urutan := null;
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');

  insert into public.participants (room_id, nama, urutan_giliran)
    values (v_room.id, trim(p_nama), v_urutan)
    returning id into v_participant_id;
  insert into public.participant_secrets (participant_id, token)
    values (v_participant_id, v_token);

  return query select v_room.id, v_participant_id, v_token;
end;
$$;

grant execute on function public.mulai_sesi(text, text) to anon;
grant execute on function public.giliran_berikutnya(text, text) to anon;
grant execute on function public.putar_roda(text, text, text) to anon;
grant execute on function public.masuk_room(text, text) to anon;
```

- [ ] **Step 2: Terapkan dan verifikasi alur lengkap di SQL Editor**

```sql
select * from public.buat_room('Juan', array['A?', 'B?', 'C?']);
-- catat kode, host_token, participant_token
select * from public.masuk_room('KODE', 'Budi');
select public.mulai_sesi('KODE', 'HOST_TOKEN');
select urutan_giliran, nama from public.participants
 where room_id = (select id from public.rooms where kode = 'KODE')
 order by urutan_giliran;
```

Expected: kedua peserta punya `urutan_giliran` 0 dan 1 dalam urutan acak, dan status room jadi `berjalan`.

- [ ] **Step 3: Verifikasi penguncian giliran benar-benar menolak**

Cari tahu siapa pemilik giliran 0, lalu panggil `putar_roda` dengan token peserta **yang bukan** pemiliknya, dan `p_host_token => null`:

```sql
select * from public.putar_roda('KODE', 'TOKEN_BUKAN_PEMILIK', null);
```

Expected: `sekarang bukan giliranmu`.

- [ ] **Step 4: Verifikasi host boleh memutar mewakili**

```sql
select * from public.putar_roda('KODE', 'TOKEN_HOST', 'HOST_TOKEN');
```

Expected: berhasil. Lalu periksa bahwa putarannya dicatat atas nama **pemilik giliran**, bukan host:

```sql
select p.nama from public.spins s
  join public.participants p on p.id = s.participant_id
 where s.room_id = (select id from public.rooms where kode = 'KODE')
 order by s.nomor_giliran desc limit 1;
```

Expected: nama pemilik giliran nomor 0.

- [ ] **Step 5: Verifikasi pendatang telat masuk ke ekor**

```sql
select * from public.masuk_room('KODE', 'Citra');
select nama, urutan_giliran from public.participants
 where room_id = (select id from public.rooms where kode = 'KODE')
 order by urutan_giliran;
```

Expected: Citra punya `urutan_giliran = 2`, yaitu terbesar.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0004_giliran.sql
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

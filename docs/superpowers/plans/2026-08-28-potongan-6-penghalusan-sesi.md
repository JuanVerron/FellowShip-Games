# Potongan 6 — Penghalusan Sesi: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Host bisa menyisipkan pertanyaan di tengah sesi; peserta yang HP-nya terkunci atau halamannya dimuat ulang kembali ke keadaan yang benar tanpa mengetik nama lagi; dan tampilannya rapi di layar potret HP.

**Architecture:** Pemulihan tidak memakai keadaan yang disimpan di memori browser — halaman selalu membangun ulang tampilannya dari database, dan identitas dipulihkan dari token di localStorage. Yang ditambahkan di potongan ini cuma pemicunya: saat tab kembali terlihat dan saat jaringan kembali tersambung, data ditarik ulang dan langganan Realtime dipasang lagi.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind, `@supabase/supabase-js`, Vitest, Postgres.

**Spec:** `PRD.md` bagian 4.4 (sisipan), 4.5 (pemulihan), 8 (batasan tampilan) dan Build Order Potongan 6.

**Prasyarat:** Potongan 5 selesai — semua butir "Definisi Selesai Potongan 5" terpenuhi.

## Global Constraints

- Nol biaya. Package manager: pnpm. Uji: `pnpm test`.
- Antarmuka berbahasa Inggris, bernada percakapan. Potret HP 360px. Sentuh minimal 44px.
- Pertanyaan sisipan masuk kolam untuk putaran berikutnya, **tidak boleh** dipaksa keluar sekarang.
- Pertanyaan sisipan hidup di room itu saja; tidak masuk bank permanen.
- Hormati `prefers-reduced-motion`.
- Satu commit per task.

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `supabase/migrations/0008_sisipan.sql` | Fungsi `sisip_pertanyaan` milik host |
| `src/lib/sisipan.ts` | Merapikan dan memvalidasi teks sisipan, serta membungkus RPC-nya |
| `src/hooks/useRoom.ts` | Diperluas: menarik ulang data saat tab kembali terlihat dan saat jaringan pulih |
| `src/components/KotakSisipan.tsx` | Kotak isian sisipan, hanya tampil untuk host |
| `src/app/room/[kode]/page.tsx` | Diperluas: kotak sisipan, dan ajakan masuk saat identitas belum ada |
| `src/app/layout.tsx` | Judul, deskripsi, dan pengaturan viewport untuk layar HP |

---

### Task 1: Fungsi sisip pertanyaan

**Files:**
- Create: `supabase/migrations/0008_sisipan.sql`

**Interfaces:**
- Consumes: `rooms`, `room_secrets`, `room_questions` (Potongan 2–5)
- Produces: `public.sisip_pertanyaan(p_kode text, p_host_token text, p_teks text)` → `uuid`

- [x] **Step 1: Tulis berkas migrasi**

Buat `supabase/migrations/0008_sisipan.sql`:

```sql
-- Sisipan pertanyaan milik host, di tengah sesi yang sedang berjalan.
--
-- Semua acuan kolom diawali nama tabelnya, mengikuti pola migrasi Potongan 4
-- dan 5. `extensions` ikut di search_path supaya sejalan dengan fungsi lain,
-- walau fungsi ini sendiri belum memanggil apa pun dari sana.
create or replace function public.sisip_pertanyaan(
  p_kode text,
  p_host_token text,
  p_teks text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room public.rooms%rowtype;
  v_urutan int;
  v_id uuid;
begin
  select * into v_room from public.rooms
   where rooms.kode = upper(trim(p_kode)) and rooms.kedaluwarsa_pada > now();
  if not found then
    raise exception 'Room not found.';
  end if;

  -- Kewenangan host dibuktikan dengan host_token, bukan dengan kotak sisipan
  -- yang cuma disembunyikan di browser.
  if not exists (select 1 from public.room_secrets
                  where room_secrets.room_id = v_room.id
                    and room_secrets.host_token = p_host_token) then
    raise exception 'Only the host can add a question.';
  end if;

  if v_room.status = 'selesai' then
    raise exception 'This session has already finished.';
  end if;

  if p_teks is null or length(trim(p_teks)) = 0 then
    raise exception 'A question needs some text.';
  end if;

  if length(trim(p_teks)) > 200 then
    raise exception 'That question is too long, 200 characters max.';
  end if;

  select coalesce(max(q.urutan), -1) + 1 into v_urutan
    from public.room_questions q where q.room_id = v_room.id;

  -- Masuk kolam dengan sudah_keluar = false, sehingga ia ikut undian
  -- putaran BERIKUTNYA. Tidak ada jalan bagi host untuk memaksanya keluar
  -- sekarang juga; itu disengaja, supaya roda tidak bisa diarahkan.
  insert into public.room_questions (room_id, sumber, teks, urutan)
    values (v_room.id, 'custom', trim(p_teks), v_urutan)
    returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.sisip_pertanyaan(text, text, text) to anon;
```

- [x] **Step 2: Terapkan dan verifikasi**

Terapkan lewat CLI, bukan dashboard, supaya langkah ini bisa dijalankan tanpa tangan manusia:

```bash
set -a; . ./.env.local; set +a
npx supabase db push --password "$SUPABASE_DB_PASSWORD"
```

Lalu, dengan room yang sudah ada:

```bash
node scripts/sql.mjs "select public.sisip_pertanyaan('KODE','HOST_TOKEN','A question out of nowhere?');"
node scripts/sql.mjs "select public.sisip_pertanyaan('KODE','token-ngawur','Should be rejected?');"
```

Rangkaiannya ditulis sebagai `scripts/verifikasi-sisipan.mjs`, mengikuti pola `scripts/verifikasi-kolam.mjs`. Jalankan dengan `node scripts/verifikasi-sisipan.mjs`: tujuh pemeriksaan, semuanya harus lulus. Yang paling berarti di antaranya adalah penolakan terhadap peserta biasa — itu membuktikan penjagaannya ada di database, bukan pada kotak sisipan yang cuma disembunyikan di browser.

- [x] **Step 3: Commit**

```bash
git add supabase/migrations/0008_sisipan.sql
git commit -m "feat: fungsi sisip pertanyaan untuk host"
```

---

### Task 2: Validasi dan pembungkus sisipan

**Files:**
- Create: `src/lib/sisipan.ts`
- Test: `src/lib/__tests__/sisipan.test.ts`

**Interfaces:**
- Consumes: `sisip_pertanyaan` (Task 1)
- Produces:
  - `PANJANG_SISIPAN_MAKS = 200`
  - `rapikanPertanyaan(masukan: string): string`
  - `pertanyaanValid(teks: string): boolean`
  - `sisipPertanyaan(kode: string, hostToken: string, teks: string): Promise<string>`

- [ ] **Step 1: Tulis uji yang gagal**

Buat `src/lib/__tests__/sisipan.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { pertanyaanValid, rapikanPertanyaan } from '@/lib/sisipan'

describe('rapikanPertanyaan', () => {
  it('membuang spasi ujung dan merapatkan spasi ganda', () => {
    expect(rapikanPertanyaan('  Apa   kabar? ')).toBe('Apa kabar?')
  })

  it('mengganti baris baru dengan spasi supaya tetap satu pertanyaan', () => {
    expect(rapikanPertanyaan('Apa\nkabar?')).toBe('Apa kabar?')
  })
})

describe('pertanyaanValid', () => {
  it('menerima pertanyaan wajar', () => {
    expect(pertanyaanValid('Apa mimpimu?')).toBe(true)
  })

  it('menolak yang kosong', () => {
    expect(pertanyaanValid('   ')).toBe(false)
  })

  it('menolak yang lebih dari 200 karakter', () => {
    expect(pertanyaanValid(`${'a'.repeat(200)}?`)).toBe(false)
  })
})
```

- [ ] **Step 2: Jalankan uji dan pastikan gagal**

Run: `pnpm test`
Expected: GAGAL — `Cannot find module '@/lib/sisipan'`.

- [ ] **Step 3: Tulis implementasinya**

Buat `src/lib/sisipan.ts`:

```typescript
import { buatKlienSupabase } from '@/lib/supabase'

export const PANJANG_SISIPAN_MAKS = 200

export function rapikanPertanyaan(masukan: string): string {
  return masukan.replace(/\s+/g, ' ').trim()
}

export function pertanyaanValid(teks: string): boolean {
  const rapi = rapikanPertanyaan(teks)
  return rapi.length >= 1 && rapi.length <= PANJANG_SISIPAN_MAKS
}

export async function sisipPertanyaan(
  kode: string,
  hostToken: string,
  teks: string,
): Promise<string> {
  const { data, error } = await buatKlienSupabase().rpc('sisip_pertanyaan', {
    p_kode: kode,
    p_host_token: hostToken,
    p_teks: rapikanPertanyaan(teks),
  })
  if (error) throw new Error(error.message)
  return data as string
}
```

- [ ] **Step 4: Jalankan uji dan pastikan lulus**

Run: `pnpm test`
Expected: LULUS — semua uji hijau, tidak ada yang gagal atau di-skip.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sisipan.ts src/lib/__tests__/sisipan.test.ts
git commit -m "feat: validasi dan pembungkus sisipan pertanyaan"
```

---

### Task 3: Pemulihan setelah tab tersembunyi atau jaringan putus

**Files:**
- Modify: `src/hooks/useRoom.ts`

**Interfaces:**
- Consumes: `ambilRoom`, `ambilPeserta`, `ambilKolam`, `ambilPutaranTerakhir` (Potongan 2–3)
- Produces: `useRoom(kode)` yang menarik ulang data saat tab kembali terlihat dan saat peristiwa `online` terjadi

- [ ] **Step 1: Ganti isi hook**

Ganti seluruh isi `src/hooks/useRoom.ts`:

```typescript
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ambilKolam,
  ambilPutaranTerakhir,
  type PertanyaanKolam,
  type Putaran,
} from '@/lib/putaran'
import { ambilPeserta, ambilRoom, type Peserta, type Room } from '@/lib/room'
import { buatKlienSupabase } from '@/lib/supabase'

const TABEL_DISIMAK = ['rooms', 'participants', 'room_questions', 'spins'] as const

export function useRoom(kode: string) {
  const [room, setRoom] = useState<Room | null>(null)
  const [peserta, setPeserta] = useState<Peserta[]>([])
  const [kolam, setKolam] = useState<PertanyaanKolam[]>([])
  const [putaran, setPutaran] = useState<Putaran | null>(null)
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)

  const dibatalkan = useRef(false)

  const muatUlang = useCallback(async () => {
    try {
      const r = await ambilRoom(kode)
      if (dibatalkan.current) return

      setRoom(r)
      if (!r) {
        setPeserta([])
        setKolam([])
        setPutaran(null)
        setGalat('Room not found.')
        return
      }

      const [daftarPeserta, daftarKolam, putaranTerakhir] = await Promise.all([
        ambilPeserta(r.id),
        ambilKolam(r.id),
        ambilPutaranTerakhir(r.id),
      ])
      if (dibatalkan.current) return

      setPeserta(daftarPeserta)
      setKolam(daftarKolam)
      setPutaran(putaranTerakhir)
      setGalat(null)
    } catch (e) {
      if (!dibatalkan.current) {
        setGalat(e instanceof Error ? e.message : 'Could not load this room.')
      }
    } finally {
      if (!dibatalkan.current) setMemuat(false)
    }
  }, [kode])

  useEffect(() => {
    dibatalkan.current = false
    const klien = buatKlienSupabase()

    void muatUlang()

    const saluran = klien.channel(`room:${kode}`)
    for (const tabel of TABEL_DISIMAK) {
      saluran.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tabel },
        () => void muatUlang(),
      )
    }
    saluran.subscribe()

    // Saat HP dikunci lalu dibuka lagi, koneksi Realtime bisa sudah putus
    // tanpa pemberitahuan. Menarik ulang data di sini yang membuat layar
    // kembali benar alih-alih membeku di keadaan lama.
    function saatKembaliTerlihat() {
      if (document.visibilityState === 'visible') void muatUlang()
    }

    document.addEventListener('visibilitychange', saatKembaliTerlihat)
    window.addEventListener('online', saatKembaliTerlihat)

    return () => {
      dibatalkan.current = true
      document.removeEventListener('visibilitychange', saatKembaliTerlihat)
      window.removeEventListener('online', saatKembaliTerlihat)
      void klien.removeChannel(saluran)
    }
  }, [kode, muatUlang])

  return { room, peserta, kolam, putaran, memuat, galat, muatUlang }
}
```

- [ ] **Step 2: Uji pemulihan secara manual**

Run: `pnpm dev`. Buka room di dua jendela dan mulai sesi.

1. Di jendela B, buka tab lain selama beberapa saat (mensimulasikan HP terkunci).
2. Sementara itu, di jendela A tekan PUTAR dan lalu Giliran Berikutnya.
3. Kembali ke jendela B.

Expected: jendela B langsung menampilkan pertanyaan dan giliran yang benar, tanpa dimuat ulang manual.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useRoom.ts
git commit -m "feat: tarik ulang data saat tab kembali terlihat dan jaringan pulih"
```

---

### Task 4: Kotak sisipan, ajakan masuk, dan perapian tampilan

**Files:**
- Create: `src/components/KotakSisipan.tsx`
- Modify: `src/app/room/[kode]/page.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `sisipPertanyaan`, `pertanyaanValid` (Task 2); `useRoom` (Task 3)
- Produces: komponen `<KotakSisipan kode={string} hostToken={string} />`

- [ ] **Step 1: Buat kotak sisipan**

Buat `src/components/KotakSisipan.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { pertanyaanValid, sisipPertanyaan } from '@/lib/sisipan'

export function KotakSisipan({
  kode,
  hostToken,
}: {
  kode: string
  hostToken: string
}) {
  const [teks, setTeks] = useState('')
  const [terbuka, setTerbuka] = useState(false)
  const [sibuk, setSibuk] = useState(false)
  const [kabar, setKabar] = useState<string | null>(null)

  async function kirim() {
    if (!pertanyaanValid(teks)) {
      setKabar('A question needs some text, 200 characters max.')
      return
    }

    setSibuk(true)
    setKabar(null)
    try {
      await sisipPertanyaan(kode, hostToken, teks)
      setTeks('')
      setKabar('Added to the pool for the next spin.')
    } catch (e) {
      setKabar(e instanceof Error ? e.message : 'Could not add that question.')
    } finally {
      setSibuk(false)
    }
  }

  if (!terbuka) {
    return (
      <button
        type="button"
        onClick={() => setTerbuka(true)}
        className="min-h-[44px] rounded-xl border-2 border-dashed text-sm font-semibold opacity-70"
      >
        + Sisipkan pertanyaan
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border-2 p-3">
      <textarea
        value={teks}
        onChange={(e) => setTeks(e.target.value)}
        rows={2}
        maxLength={200}
        placeholder="Pertanyaan dadakan…"
        className="rounded-lg border-2 p-2 text-base"
      />
      {kabar && <p className="text-xs opacity-70">{kabar}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={kirim}
          disabled={sibuk}
          className="min-h-[44px] flex-1 rounded-lg bg-black font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          {sibuk ? 'Adding…' : 'Add to pool'}
        </button>
        <button
          type="button"
          onClick={() => setTerbuka(false)}
          className="min-h-[44px] rounded-lg border-2 px-4"
        >
          Tutup
        </button>
      </div>
    </div>
  )
}
```

Pesan setelah berhasil berbunyi "Masuk kolam untuk putaran berikutnya", bukan sekadar "Berhasil". Itu yang mencegah host mengira pertanyaannya akan langsung keluar dan lalu bingung waktu roda memilih yang lain.

- [ ] **Step 2: Pasang kotak sisipan dan ajakan masuk**

Di `src/app/room/[kode]/page.tsx`:

Tambahkan impor:

```tsx
import Link from 'next/link'
import { KotakSisipan } from '@/components/KotakSisipan'
```

Sisipkan blok berikut tepat **sebelum** `if (room.status === 'selesai')`, supaya orang yang membuka tautan room tanpa pernah bergabung tidak melihat tombol-tombol mati tanpa penjelasan:

```tsx
  if (!identitas) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg">Kamu belum bergabung di room ini.</p>
        <Link
          href="/masuk"
          className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-black px-4 font-semibold text-white dark:bg-white dark:text-black"
        >
          Masuk dengan kode {room.kode}
        </Link>
      </main>
    )
  }
```

Lalu di blok sesi berjalan, tepat di bawah tombol "Giliran berikutnya", tambahkan:

```tsx
      {adalahHost && (
        <KotakSisipan kode={kode} hostToken={identitas.hostToken!} />
      )}
```

- [ ] **Step 3: Rapikan kerangka halaman**

Ganti `metadata` dan tambahkan `viewport` di `src/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Fellowship Games',
  description: 'Question bank roulette for fellowship sessions',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#000000',
}
```

`maximumScale: 5` disengaja: mengunci perbesaran memang membuat tampilan terasa rapi, tapi merampas kemampuan orang yang penglihatannya kurang untuk membaca pertanyaan.

- [ ] **Step 4: Uji sisipan di tengah sesi**

Run: `pnpm dev`. Buka dua jendela, mulai sesi, putar sekali.

1. Di jendela host, tekan **+ Sisipkan pertanyaan**, ketik satu pertanyaan, tekan Tambah.

Expected: pesan "Masuk kolam untuk putaran berikutnya", penghitung sisa naik satu di **kedua** layar, dan roda bertambah satu segmen.

2. Tekan Giliran Berikutnya, lalu putar beberapa kali.

Expected: pertanyaan sisipan itu ikut berpeluang keluar seperti yang lain.

- [ ] **Step 5: Uji ajakan masuk**

Buka `/room/KODE` di jendela penyamaran baru yang belum pernah bergabung.
Expected: tampilan "Kamu belum bergabung di room ini" berikut tombol menuju layar masuk — bukan tombol PUTAR yang mati tanpa keterangan.

- [ ] **Step 6: Periksa tampilan di layar sempit**

Buka DevTools → mode perangkat → lebar **360px**. Telusuri semua layar: depan, buat room, masuk, ruang tunggu, sesi, selesai.

Expected: tidak ada yang terpotong, tidak ada gulir mendatar, semua tombol tingginya minimal 44px, dan teks pertanyaan terbaca besar.

- [ ] **Step 7: Periksa penghormatan pada "kurangi animasi"**

DevTools → Rendering → **Emulate CSS prefers-reduced-motion: reduce**. Putar roda.
Expected: hasilnya tetap muncul, tapi tanpa animasi putaran panjang.

- [ ] **Step 8: Uji, build, commit, deploy**

```bash
pnpm test && pnpm build
git add -A
git commit -m "feat: sisipan pertanyaan, ajakan masuk, dan perapian tampilan HP"
pnpm dlx vercel@latest --prod
```

---

## Definisi Selesai Potongan 6 — dan Fase 1

1. `pnpm test` lulus seluruhnya, tidak ada yang gagal atau di-skip. `pnpm build` bersih.
2. Host menyisipkan pertanyaan di tengah sesi; ia masuk kolam, terlihat di semua layar, dan ikut undian putaran berikutnya — tidak pernah dipaksa keluar seketika.
3. Peserta bukan host tidak punya jalan menyisipkan pertanyaan, termasuk lewat pemanggilan langsung ke database.
4. HP dikunci beberapa menit lalu dibuka: layar kembali ke giliran dan pertanyaan yang benar tanpa mengetik nama ulang.
5. Membuka tautan room tanpa pernah bergabung memunculkan ajakan masuk, bukan tombol mati.
6. Pada lebar 360px tidak ada gulir mendatar di layar mana pun.
7. Dengan "kurangi animasi" menyala, roda tetap memberi hasil tanpa putaran panjang.

**Setelah ketujuhnya terpenuhi, Fase 1 selesai.** Jalankan satu sesi fellowship sungguhan sebelum menyentuh apa pun dari Fase 2 — urutan pengerjaan Fase 2 memang sengaja belum ditetapkan, karena kenyataan sesi pertama yang berhak menentukannya.

---

## Catatan Perubahan

Rencana ini ditulis sebelum Potongan 1–5 dikerjakan. Yang berubah setelah diselaraskan dengan kenyataan repo:

1. **Migrasi `0006_sisipan.sql` jadi `0008_sisipan.sql`.** Potongan 4 memakai `0005_giliran.sql` dan `0006_opsi_room.sql`; Potongan 5 memakai `0007_opsi_dan_kolam.sql`.

2. **Pesan galat SQL dan seluruh teks antarmuka diterjemahkan ke Inggris.** `CLAUDE.md` diperbarui setelah rencana ini ditulis. Yang ikut berubah: pesan `sisip_pertanyaan`, kabar di kotak sisipan, label tombol `Add to pool`, pesan galat pemulihan room, dan `metadata.description` di `layout.tsx` — yang di repo sudah berbahasa Inggris, sehingga rencana lama justru akan memundurkannya. Fixture uji tetap berbahasa Indonesia; itu kode, bukan antarmuka.

3. **`search_path` jadi `public, extensions` dan semua acuan kolom diawali nama tabelnya.** Mengikuti pola yang sudah terbukti di migrasi Potongan 4 dan 5.

4. **Verifikasi pindah dari SQL Editor ke CLI.** `npx supabase db push` dan `node scripts/sql.mjs` menggantikan langkah tempel-dan-Run di dashboard.

5. **Angka uji mati diganti patokan relatif.** "58 uji" tidak lagi bermakna setelah akhir Potongan 4 saja sudah 62.

### Penyimpangan yang disengaja dari `CLAUDE.md`

`CLAUDE.md` mensyaratkan tiap potongan dibuka dan diuji di HP sungguhan sebelum potongan berikutnya dimulai. Atas keputusan pemilik project pada 2026-08-29, Potongan 5 dan 6 dikerjakan berurutan tanpa jeda uji di antaranya, dan keduanya diuji sekaligus di akhir.

Risikonya diketahui dan diterima: bug Potongan 5 yang hanya muncul di HP sungguhan — tata letak 360px, perilaku Realtime saat layar terkunci, ukuran sasaran sentuh — baru ketahuan setelah Potongan 6 menumpuk di atasnya, sehingga penelusurannya lebih mahal. Yang menahan risiko itu sementara: `pnpm test`, `pnpm build`, dan verifikasi fungsi database lewat `scripts/sql.mjs` di tiap task.

Uji HP gabungan di akhir menjadi syarat mati Fase 1. Ia tidak boleh dilewati, dan tujuh butir "Definisi Selesai" di atas tetap berlaku utuh.

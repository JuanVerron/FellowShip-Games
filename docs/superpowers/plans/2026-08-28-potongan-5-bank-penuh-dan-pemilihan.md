# Potongan 5 — Bank Penuh dan Pemilihannya: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bank 300–450 pertanyaan dua tingkat tersedia sebagai berkas statis; host menjelajahinya lewat accordion dan mencentang per tema, per sub-tema, atau satuan; bisa menambah pertanyaan tulis sendiri; dan sesi berakhir rapi saat kolam habis.

**Architecture:** Bank tidak pernah masuk database — ia berkas TypeScript yang ikut dibundel, dan layar penjelajahan bekerja sepenuhnya di browser tanpa satu pun panggilan server. Yang dikirim ke database cuma daftar pertanyaan yang benar-benar dipilih, sebagai salinan teks, sehingga room utuh sendiri walau bank berubah lewat deploy berikutnya.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind, `@supabase/supabase-js`, Vitest, Postgres.

**Spec:** `PRD.md` bagian 4.1, 4.2, 4.4 (sisa pertanyaan dan sesi selesai) dan Build Order Potongan 5.

**Prasyarat:** Potongan 4 selesai — semua butir "Definisi Selesai Potongan 4" terpenuhi.

## Global Constraints

- Nol biaya. Package manager: pnpm. Uji: `pnpm test`.
- Antarmuka berbahasa Inggris, bernada percakapan — termasuk teks pertanyaan di bank dan nama tema yang tampil di accordion. Potret HP 360px. Sentuh minimal 44px.
- Bank berstruktur **tepat dua tingkat**: Tema → Sub-tema. Tidak ada tingkat ketiga, tidak ada label lintas tema.
- Bank hanya bisa diubah lewat berkas di repo. Tidak boleh ada layar tambah/ubah/hapus bank di aplikasi.
- Jumlah tema atau sub-tema yang dipilih saat membuat room **tidak dibatasi**.
- Pertanyaan tulis sendiri hidup di room itu saja, tidak pernah masuk bank permanen.
- Satu commit per task.

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `src/data/bank-pertanyaan.ts` | Isi bank. Satu larik datar; hierarki muncul dari kolom `tema` dan `subTema` |
| `src/lib/bank.ts` | Mengelompokkan larik datar jadi pohon dua tingkat. Murni, tanpa I/O |
| `src/lib/pilihan.ts` | Aritmetika pencentangan: apa yang terpilih, apa yang sebagian, apa efek satu klik |
| `src/components/PenjelajahBank.tsx` | Accordion tema → sub-tema → pertanyaan, dengan tiga tingkat pencentangan |
| `src/app/buat/page.tsx` | Dirombak: penjelajah bank, kotak tulis sendiri, dua sakelar opsi |
| `supabase/migrations/0007_opsi_dan_kolam.sql` | `buat_room` versi opsi lengkap dan `putar_roda` yang menghormati opsi buang-terpakai |
| `src/data/contoh-pertanyaan.ts` | **Dihapus** di task terakhir |

---

### Task 1: Isi bank dan penjaganya

**Files:**
- Create: `src/data/bank-pertanyaan.ts`
- Test: `src/data/__tests__/bank-pertanyaan.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `type PertanyaanBank = { id: string; tema: string; subTema: string; teks: string }`
  - `BANK: PertanyaanBank[]`

**Taksonomi yang harus dipakai persis.** Ini keputusan struktur, bukan selera — jangan diganti sambil menulis isinya:

| Tema | Sub-tema |
|---|---|
| SPIRITUAL | Faith, Prayer, Doubt, Calling |
| FAMILY | Childhood, Funny Moments, Conflict, Gratitude |
| SELF | Fears, Dreams, Habits, Weaknesses |
| FRIENDSHIP | Memories, Trust, Loss |
| LOVE | Feelings, Heartbreak, Hope |
| WORK | Ambition, Failure, Daily Grind |
| LIGHT | Food, Music, Odd Picks, What If |
| PAST | Regrets, Turning Points, People Who Helped |
| FUTURE | Plans, Worries, Legacy |
| CONFESSIONS | Small Secrets, Awkward Moments, Honesty |

Sepuluh tema, 34 sub-tema. Isi **10–13 pertanyaan per sub-tema**, sehingga totalnya jatuh di kisaran 340–440.

Aturan penulisan isi:

- `id` berbentuk `<slug-tema>-<slug-sub-tema>-<dua digit>`, contoh `spiritual-faith-01`, `light-what-if-07`. Slug huruf kecil, spasi jadi tanda hubung. Id tidak pernah didaur ulang.
- Teks berbahasa Inggris percakapan, menyapa dengan "you", diakhiri tanda tanya.
- Satu pertanyaan menanyakan satu hal. Jangan menggabung dua pertanyaan dengan "dan".
- Tidak ada dua pertanyaan berteks sama persis di seluruh bank.
- Panjang wajar untuk dibaca di layar HP: di bawah 120 karakter.

**Aturan nilai — ini yang menentukan bank layak dipakai atau tidak.** Bank ini dipakai di sesi fellowship, dan pertanyaannya ikut menentukan ke mana obrolan bergerak.

- Tidak ada muatan seksual dalam bentuk apa pun, termasuk sindiran dan lelucon.
- Jangan mengajak orang menceritakan, membanggakan, atau meromantisasi dosa — mabuk, judi, balas dendam, perselingkuhan, kebencian.
- `CONFESSIONS` bukan ruang mengorek aib. Isinya hal memalukan yang bisa ditertawakan bersama dan kejujuran yang membangun, bukan pengakuan yang mempermalukan orang di depan kelompoknya.
- `LOVE` bicara perasaan, patah hati, dan pengharapan — bukan riwayat pacaran atau perbandingan mantan.
- Nada yang dituju: pertanyaan yang membuat orang lebih dekat satu sama lain **dan** lebih dekat kepada Tuhan, sejalan teladan Yesus. Kalau sebuah pertanyaan tidak lolos ukuran itu, ganti — jangan dipaksakan supaya jumlahnya cukup.

Step 1 memasang uji yang menolak daftar kata terlarang. Uji itu **lantai, bukan langit-langit**: lolos di sana tidak berarti pertanyaannya pantas. Yang menjaga selera tetap aturan di atas.

Contoh utuh satu sub-tema, dipakai sebagai model untuk 33 sub-tema lainnya:

```typescript
  { id: 'spiritual-faith-01', tema: 'SPIRITUAL', subTema: 'Faith', teks: 'When did you last feel that God was really close?' },
  { id: 'spiritual-faith-02', tema: 'SPIRITUAL', subTema: 'Faith', teks: 'Which part of your faith is hardest to explain to someone else?' },
  { id: 'spiritual-faith-03', tema: 'SPIRITUAL', subTema: 'Faith', teks: 'Who has shaped the way you believe the most?' },
  { id: 'spiritual-faith-04', tema: 'SPIRITUAL', subTema: 'Faith', teks: 'What keeps you holding on when everything feels heavy?' },
  { id: 'spiritual-faith-05', tema: 'SPIRITUAL', subTema: 'Faith', teks: 'Which verse or line do you come back to most often?' },
  { id: 'spiritual-faith-06', tema: 'SPIRITUAL', subTema: 'Faith', teks: 'Has your faith changed shape as you have grown older?' },
  { id: 'spiritual-faith-07', tema: 'SPIRITUAL', subTema: 'Faith', teks: 'What is the smallest thing that kept you thankful all day?' },
  { id: 'spiritual-faith-08', tema: 'SPIRITUAL', subTema: 'Faith', teks: 'If your faith had a voice, what would it say to you most?' },
  { id: 'spiritual-faith-09', tema: 'SPIRITUAL', subTema: 'Faith', teks: 'When is it hardest for you to believe things will be okay?' },
  { id: 'spiritual-faith-10', tema: 'SPIRITUAL', subTema: 'Faith', teks: 'What would you ask God if you only got one question?' },
```

- [ ] **Step 1: Tulis uji penjaga integritas bank lebih dulu**

Buat `src/data/__tests__/bank-pertanyaan.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { BANK } from '@/data/bank-pertanyaan'

const TAKSONOMI: Record<string, string[]> = {
  SPIRITUAL: ['Faith', 'Prayer', 'Doubt', 'Calling'],
  FAMILY: ['Childhood', 'Funny Moments', 'Conflict', 'Gratitude'],
  SELF: ['Fears', 'Dreams', 'Habits', 'Weaknesses'],
  FRIENDSHIP: ['Memories', 'Trust', 'Loss'],
  LOVE: ['Feelings', 'Heartbreak', 'Hope'],
  WORK: ['Ambition', 'Failure', 'Daily Grind'],
  LIGHT: ['Food', 'Music', 'Odd Picks', 'What If'],
  PAST: ['Regrets', 'Turning Points', 'People Who Helped'],
  FUTURE: ['Plans', 'Worries', 'Legacy'],
  CONFESSIONS: ['Small Secrets', 'Awkward Moments', 'Honesty'],
}

describe('bank pertanyaan', () => {
  it('berisi antara 300 dan 450 pertanyaan', () => {
    expect(BANK.length).toBeGreaterThanOrEqual(300)
    expect(BANK.length).toBeLessThanOrEqual(450)
  })

  it('tidak punya id kembar', () => {
    const id = BANK.map((p) => p.id)
    expect(new Set(id).size).toBe(id.length)
  })

  it('tidak punya teks kembar', () => {
    const teks = BANK.map((p) => p.teks.toLowerCase().trim())
    expect(new Set(teks).size).toBe(teks.length)
  })

  it('hanya memakai tema dan sub-tema dari taksonomi', () => {
    for (const p of BANK) {
      expect(TAKSONOMI[p.tema], `tema tak dikenal: ${p.tema}`).toBeDefined()
      expect(TAKSONOMI[p.tema]).toContain(p.subTema)
    }
  })

  it('mengisi setiap sub-tema dengan 10 sampai 13 pertanyaan', () => {
    for (const [tema, daftarSub] of Object.entries(TAKSONOMI)) {
      for (const subTema of daftarSub) {
        const jumlah = BANK.filter(
          (p) => p.tema === tema && p.subTema === subTema,
        ).length
        expect(jumlah, `${tema} → ${subTema}`).toBeGreaterThanOrEqual(10)
        expect(jumlah, `${tema} → ${subTema}`).toBeLessThanOrEqual(13)
      }
    }
  })

  it('menulis semua pertanyaan sebagai kalimat tanya yang tidak kepanjangan', () => {
    for (const p of BANK) {
      expect(p.teks.endsWith('?'), p.id).toBe(true)
      expect(p.teks.length, p.id).toBeLessThan(120)
    }
  })

  // Penjaga nilai. Bank ini dipakai di sesi fellowship, jadi pertanyaannya
  // tidak boleh menggiring obrolan ke hal yang menjauhkan orang dari Tuhan.
  //
  // Daftar ini lantai, bukan langit-langit: lolos di sini tidak berarti
  // pertanyaannya pantas. Aturan nilai di kepala Task 1 yang menjaga selera,
  // dan pembacaan manusia di Step 6 tetap langkah terakhir.
  it('tidak memuat topik yang menjauhkan dari teladan Yesus', () => {
    const TERLARANG = [
      'sex', 'sexy', 'sexual', 'porn', 'nude', 'naked', 'hookup',
      'drunk', 'drunken', 'booze', 'alcohol', 'drug', 'drugs', 'weed',
      'gamble', 'gambling', 'affair', 'affairs', 'revenge',
    ]
    const pola = new RegExp(`\b(${TERLARANG.join('|')})\b`, 'i')
    for (const p of BANK) {
      const cocok = p.teks.match(pola)
      expect(cocok?.[0], `${p.id}: "${p.teks}"`).toBeUndefined()
    }
  })
})
```

Uji inilah yang menggantikan pemeriksaan manual atas 400 baris data. Tanpa itu, satu sub-tema yang terlewat atau satu id kembar akan lolos sampai muncul sebagai bug aneh di tengah sesi.

- [ ] **Step 2: Jalankan dan pastikan gagal**

Run: `pnpm test`
Expected: GAGAL — `Cannot find module '@/data/bank-pertanyaan'`.

- [ ] **Step 3: Tulis kerangka berkas bank**

Buat `src/data/bank-pertanyaan.ts`:

```typescript
export type PertanyaanBank = {
  id: string
  tema: string
  subTema: string
  teks: string
}

// Bank permanen. Hanya bisa diubah lewat berkas ini, lalu deploy ulang.
// Struktur tepat dua tingkat: tema → subTema. Jangan tambah tingkat ketiga.
//
// Teksnya berbahasa Inggris karena ini yang dibaca peserta di layar.
export const BANK: PertanyaanBank[] = [
  // SPIRITUAL → Faith
  { id: 'spiritual-faith-01', tema: 'SPIRITUAL', subTema: 'Faith', teks: 'When did you last feel that God was really close?' },
  // … lanjutkan sesuai aturan penulisan dan aturan nilai di kepala Task 1
]
```

- [ ] **Step 4: Isi seluruh 34 sub-tema**

Tulis 10–13 pertanyaan untuk setiap pasangan tema/sub-tema di tabel taksonomi, mengikuti aturan penulisan, aturan nilai, dan gaya contoh `spiritual-faith-*` di atas. Kerjakan tema per tema supaya mudah ditelusuri kalau ada yang kurang.

- [ ] **Step 5: Jalankan uji sampai ketujuh-tujuhnya lulus**

Run: `pnpm test src/data`
Expected: LULUS — 7 uji. Kalau ada yang gagal, pesan galatnya menyebut tema dan sub-tema atau id yang bermasalah; perbaiki isinya, jangan longgarkan ujinya.

- [ ] **Step 6: Baca sekali dan coret yang tidak cocok** — *setelah loop, bukan penghalang*

Ini langkah manual untuk pemilik project, bukan untuk agen, dan **bukan syarat Task 1 dianggap selesai**. Loop lanjut ke Task 2 tanpa menunggunya. Kerjakan bersama uji HP di akhir Potongan 6: baca seluruh bank sekali dan hapus pertanyaan yang terasa tidak pas untuk kelompokmu. Setelah menghapus, jalankan `pnpm test src/data` lagi — kalau ada sub-tema yang jatuh di bawah 10, tambahkan gantinya.

- [ ] **Step 7: Commit**

```bash
git add src/data/bank-pertanyaan.ts src/data/__tests__
git commit -m "feat: bank pertanyaan dua tingkat berikut penjaga integritasnya"
```

---

### Task 2: Pengelompokan bank dan aritmetika pencentangan

**Files:**
- Create: `src/lib/bank.ts`
- Create: `src/lib/pilihan.ts`
- Test: `src/lib/__tests__/bank.test.ts`
- Test: `src/lib/__tests__/pilihan.test.ts`

**Interfaces:**
- Consumes: `PertanyaanBank`, `BANK` (Task 1)
- Produces:
  - `type SubTema = { nama: string; pertanyaan: PertanyaanBank[] }`
  - `type Tema = { nama: string; subTema: SubTema[] }`
  - `kelompokkanBank(bank: PertanyaanBank[]): Tema[]`
  - `idDiTema(tema: Tema): string[]`
  - `idDiSubTema(sub: SubTema): string[]`
  - `type KeadaanCentang = 'kosong' | 'sebagian' | 'penuh'`
  - `keadaanCentang(id: string[], terpilih: Set<string>): KeadaanCentang`
  - `alihkan(id: string[], terpilih: Set<string>): Set<string>`

- [ ] **Step 1: Tulis uji yang gagal**

Buat `src/lib/__tests__/bank.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { kelompokkanBank } from '@/lib/bank'
import type { PertanyaanBank } from '@/data/bank-pertanyaan'

const contoh: PertanyaanBank[] = [
  { id: 'a-1', tema: 'A', subTema: 'X', teks: 'p1?' },
  { id: 'b-1', tema: 'B', subTema: 'Y', teks: 'p2?' },
  { id: 'a-2', tema: 'A', subTema: 'X', teks: 'p3?' },
  { id: 'a-3', tema: 'A', subTema: 'Z', teks: 'p4?' },
]

describe('kelompokkanBank', () => {
  it('mengelompokkan jadi pohon dua tingkat', () => {
    const pohon = kelompokkanBank(contoh)
    expect(pohon.map((t) => t.nama)).toEqual(['A', 'B'])
    expect(pohon[0].subTema.map((s) => s.nama)).toEqual(['X', 'Z'])
    expect(pohon[0].subTema[0].pertanyaan.map((p) => p.id)).toEqual(['a-1', 'a-2'])
  })

  it('mempertahankan urutan kemunculan pertama, bukan urutan abjad', () => {
    const pohon = kelompokkanBank([contoh[1], contoh[0]])
    expect(pohon.map((t) => t.nama)).toEqual(['B', 'A'])
  })

  it('mengembalikan larik kosong untuk bank kosong', () => {
    expect(kelompokkanBank([])).toEqual([])
  })
})
```

Buat `src/lib/__tests__/pilihan.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { alihkan, keadaanCentang } from '@/lib/pilihan'

describe('keadaanCentang', () => {
  it('kosong saat tidak ada yang terpilih', () => {
    expect(keadaanCentang(['a', 'b'], new Set())).toBe('kosong')
  })

  it('sebagian saat baru sebagian terpilih', () => {
    expect(keadaanCentang(['a', 'b'], new Set(['a']))).toBe('sebagian')
  })

  it('penuh saat semuanya terpilih', () => {
    expect(keadaanCentang(['a', 'b'], new Set(['a', 'b']))).toBe('penuh')
  })

  it('kosong untuk kelompok tanpa isi', () => {
    expect(keadaanCentang([], new Set(['a']))).toBe('kosong')
  })
})

describe('alihkan', () => {
  it('menambah semuanya saat sebelumnya kosong', () => {
    expect([...alihkan(['a', 'b'], new Set())].sort()).toEqual(['a', 'b'])
  })

  it('menambah sisanya saat baru sebagian terpilih', () => {
    expect([...alihkan(['a', 'b'], new Set(['a']))].sort()).toEqual(['a', 'b'])
  })

  it('membuang semuanya saat sudah penuh', () => {
    expect([...alihkan(['a', 'b'], new Set(['a', 'b']))]).toEqual([])
  })

  it('tidak mengubah pilihan di luar kelompoknya', () => {
    expect([...alihkan(['a'], new Set(['a', 'z']))]).toEqual(['z'])
  })

  it('mengembalikan himpunan baru, tidak mengubah yang lama', () => {
    const semula = new Set(['a'])
    alihkan(['b'], semula)
    expect([...semula]).toEqual(['a'])
  })
})
```

"Sebagian → penuh" itu keputusan perilaku, bukan detail: menekan tema yang setengah tercentang harus **menambah sisanya**, bukan mengosongkan. Kalau kebalikannya, orang yang sudah susah payah memilih beberapa pertanyaan satuan akan kehilangan pilihannya karena satu ketukan.

- [ ] **Step 2: Jalankan uji dan pastikan gagal**

Run: `pnpm test`
Expected: GAGAL — modul `@/lib/bank` dan `@/lib/pilihan` belum ada.

- [ ] **Step 3: Tulis implementasinya**

Buat `src/lib/bank.ts`:

```typescript
import type { PertanyaanBank } from '@/data/bank-pertanyaan'

export type SubTema = { nama: string; pertanyaan: PertanyaanBank[] }
export type Tema = { nama: string; subTema: SubTema[] }

export function kelompokkanBank(bank: PertanyaanBank[]): Tema[] {
  const pohon: Tema[] = []

  for (const pertanyaan of bank) {
    let tema = pohon.find((t) => t.nama === pertanyaan.tema)
    if (!tema) {
      tema = { nama: pertanyaan.tema, subTema: [] }
      pohon.push(tema)
    }

    let sub = tema.subTema.find((s) => s.nama === pertanyaan.subTema)
    if (!sub) {
      sub = { nama: pertanyaan.subTema, pertanyaan: [] }
      tema.subTema.push(sub)
    }

    sub.pertanyaan.push(pertanyaan)
  }

  return pohon
}

export function idDiSubTema(sub: SubTema): string[] {
  return sub.pertanyaan.map((p) => p.id)
}

export function idDiTema(tema: Tema): string[] {
  return tema.subTema.flatMap(idDiSubTema)
}
```

Buat `src/lib/pilihan.ts`:

```typescript
export type KeadaanCentang = 'kosong' | 'sebagian' | 'penuh'

export function keadaanCentang(
  id: string[],
  terpilih: Set<string>,
): KeadaanCentang {
  if (id.length === 0) return 'kosong'
  const jumlah = id.filter((satu) => terpilih.has(satu)).length
  if (jumlah === 0) return 'kosong'
  return jumlah === id.length ? 'penuh' : 'sebagian'
}

export function alihkan(id: string[], terpilih: Set<string>): Set<string> {
  const baru = new Set(terpilih)
  if (keadaanCentang(id, terpilih) === 'penuh') {
    for (const satu of id) baru.delete(satu)
  } else {
    for (const satu of id) baru.add(satu)
  }
  return baru
}
```

- [ ] **Step 4: Jalankan uji dan pastikan lulus**

Run: `pnpm test`
Expected: LULUS — semua uji hijau, tidak ada yang gagal atau di-skip. Angka mati sengaja tidak dipatok di sini; yang dijaga adalah tidak ada yang merah.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bank.ts src/lib/pilihan.ts src/lib/__tests__/bank.test.ts src/lib/__tests__/pilihan.test.ts
git commit -m "feat: pengelompokan bank dan aritmetika pencentangan"
```

---

### Task 3: Opsi room dan kolam yang menyusut

**Files:**
- Create: `supabase/migrations/0007_opsi_dan_kolam.sql`

**Interfaces:**
- Consumes: `rooms`, `room_questions`, `spins` (Potongan 2–4)
- Produces:
  - `public.buat_room(p_nama_host text, p_pertanyaan jsonb, p_buang_terpakai boolean, p_izinkan_join_telat boolean)` — **menggantikan** versi dua argumen
  - `public.putar_roda(p_kode text, p_token text, p_host_token text)` — versi yang menghormati `opsi_buang_terpakai`, dan saat kolam habis menutup sesi lalu mengembalikan **nol baris** (bukan galat). Task 4 harus membaca nol baris sebagai isyarat sesi selesai.

- [ ] **Step 1: Tulis berkas migrasi**

Buat `supabase/migrations/0007_opsi_dan_kolam.sql`:

```sql
-- Opsi room lengkap dan kolam yang menyusut.
--
-- Dua perubahan sekaligus karena keduanya menyentuh fungsi yang sama:
--   1. `buat_room` menerima kedua sakelar opsi, dan daftar pertanyaannya
--      membawa asal-usul tiap butir (bank atau tulis sendiri), bukan cuma teks.
--   2. `putar_roda` menghormati `opsi_buang_terpakai` dan menutup sesi saat
--      kolam habis.
--
-- Daftar pertanyaan pindah dari `text[]` ke `jsonb` karena `room_questions`
-- punya kolom `sumber` dan `bank_question_id` sejak Potongan 4, dan larik teks
-- polos tidak punya tempat untuk membawanya.

drop function if exists public.buat_room(text, text[]);

create or replace function public.buat_room(
  p_nama_host text,
  p_pertanyaan jsonb,
  p_buang_terpakai boolean,
  p_izinkan_join_telat boolean
)
returns table (
  room_id uuid,
  kode text,
  host_token text,
  participant_id uuid,
  participant_token text
)
language plpgsql
security definer
-- `extensions` wajib ikut: gen_random_bytes tinggal di sana, bukan di public.
set search_path = public, extensions
as $$
declare
  v_room_id uuid;
  v_kode text;
  v_host_token text;
  v_participant_id uuid;
  v_participant_token text;
  v_butir jsonb;
  v_teks text;
  v_urutan int := 0;
begin
  if p_nama_host is null or length(trim(p_nama_host)) = 0
     or length(trim(p_nama_host)) > 20 then
    raise exception 'Name is required, 20 characters max.';
  end if;

  if p_pertanyaan is null or jsonb_array_length(p_pertanyaan) = 0 then
    raise exception 'A room needs at least one question.';
  end if;

  v_kode := public.buat_kode_room();
  v_host_token := encode(gen_random_bytes(24), 'hex');
  v_participant_token := encode(gen_random_bytes(24), 'hex');

  insert into public.rooms (kode, opsi_buang_terpakai, opsi_izinkan_join_telat)
    values (v_kode, coalesce(p_buang_terpakai, true),
            coalesce(p_izinkan_join_telat, true))
    returning id into v_room_id;

  insert into public.room_secrets (room_id, host_token)
    values (v_room_id, v_host_token);

  insert into public.participants (room_id, nama, adalah_host)
    values (v_room_id, trim(p_nama_host), true)
    returning id into v_participant_id;

  insert into public.participant_secrets (participant_id, token)
    values (v_participant_id, v_participant_token);

  for v_butir in select * from jsonb_array_elements(p_pertanyaan) loop
    v_teks := trim(v_butir ->> 'teks');
    if v_teks is not null and length(v_teks) > 0 then
      insert into public.room_questions
        (room_id, sumber, bank_question_id, teks, urutan)
        values (
          v_room_id,
          coalesce(v_butir ->> 'sumber', 'custom'),
          v_butir ->> 'bankId',
          v_teks,
          v_urutan
        );
      v_urutan := v_urutan + 1;
    end if;
  end loop;

  if v_urutan = 0 then
    raise exception 'A room needs at least one question.';
  end if;

  return query select v_room_id, v_kode, v_host_token,
                      v_participant_id, v_participant_token;
end;
$$;

-- Menggantikan versi Potongan 4: kolam sekarang menyusut kalau host memilih
-- opsi buang-terpakai, dan sesi berpindah ke `selesai` begitu kolam habis.
--
-- Semua acuan kolom diawali nama tabelnya. Klausa `returns table` membuat
-- `teks` jadi variabel keluaran, dan tanpa awalan itu Postgres menolak dengan
-- keluhan bahwa acuannya ambigu — galat yang sudah pernah menjaring fungsi ini
-- di Potongan 4.
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
set search_path = public, extensions
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
   where rooms.kode = upper(trim(p_kode)) and rooms.kedaluwarsa_pada > now();
  if not found then
    raise exception 'Room not found.';
  end if;

  if v_room.status <> 'berjalan' then
    raise exception 'This session has not started yet.';
  end if;

  select p.id into v_pemanggil
    from public.participants p
    join public.participant_secrets s on s.participant_id = p.id
   where p.room_id = v_room.id and s.token = p_token;
  if not found then
    raise exception 'You are not in this room.';
  end if;

  v_adalah_host := p_host_token is not null and exists (
    select 1 from public.room_secrets
     where room_secrets.room_id = v_room.id
       and room_secrets.host_token = p_host_token);

  v_pemilik := public.pemilik_giliran(v_room.id, v_room.nomor_giliran_sekarang);

  -- Penegakannya ada di sini, bukan pada tombol yang mati di browser.
  -- Tombol yang mati cuma penjelas; ini pengamannya.
  if not v_adalah_host and v_pemanggil is distinct from v_pemilik then
    raise exception 'It is not your turn yet.';
  end if;

  -- Inti opsi buang-terpakai. Kalau opsinya mati, pertanyaan yang sudah keluar
  -- tetap ikut undian dan kolam tidak pernah habis.
  select * into v_pertanyaan
    from public.room_questions q
   where q.room_id = v_room.id
     and (not v_room.opsi_buang_terpakai or not q.sudah_keluar)
   order by random()
   limit 1;

  if not found then
    -- Kolam habis. Sesi ditutup dan fungsi mengembalikan NOL BARIS.
    --
    -- Sengaja BUKAN `raise exception` di sini. Exception membatalkan seluruh
    -- transaksi, termasuk update status tepat di bawah ini, sehingga sesi tidak
    -- akan pernah benar-benar tertutup dan setiap putaran berikutnya mengulang
    -- galat yang sama. Klien membaca nol baris sebagai "kolam habis", dan
    -- Realtime mendorong perubahan status ke semua layar.
    update public.rooms set status = 'selesai' where rooms.id = v_room.id;
    return;
  end if;

  v_benih := floor(random() * 1000)::int;

  -- Batasan unik (room_id, nomor_giliran) yang menolak putaran kedua.
  -- Pesannya diganti kalimat yang bisa dibaca; yang menolak tetap batasannya.
  begin
    insert into public.spins (
      room_id, participant_id, room_question_id, nomor_giliran, benih_animasi
    ) values (
      v_room.id, coalesce(v_pemilik, v_pemanggil), v_pertanyaan.id,
      v_room.nomor_giliran_sekarang, v_benih
    );
  exception when unique_violation then
    raise exception 'This turn already has its question.';
  end;

  update public.room_questions set sudah_keluar = true
   where room_questions.id = v_pertanyaan.id;

  return query select v_pertanyaan.id, v_pertanyaan.teks,
                      v_room.nomor_giliran_sekarang, v_benih;
end;
$$;

grant execute on function public.buat_room(text, jsonb, boolean, boolean) to anon;
grant execute on function public.putar_roda(text, text, text) to anon;
```

- [ ] **Step 2: Terapkan migrasi dan verifikasi kolam habis menutup sesi**

Terapkan lewat CLI, bukan dashboard — langkah ini harus bisa dijalankan tanpa tangan manusia:

```bash
set -a; . ./.env.local; set +a
npx supabase db push --password "$SUPABASE_DB_PASSWORD"
```

Lalu buat room berisi tepat dua pertanyaan dan habiskan. `scripts/sql.mjs` memuat `.env.local` sendiri:

```bash
node scripts/sql.mjs "select * from public.buat_room('Juan', '[{\"teks\":\"One?\",\"sumber\":\"custom\"},{\"teks\":\"Two?\",\"sumber\":\"custom\"}]'::jsonb, true, true);"
```

Catat `kode`, `host_token`, dan `participant_token` dari hasilnya, lalu jalankan berurutan:

```bash
node scripts/sql.mjs "select public.mulai_sesi('KODE','HOST_TOKEN');"
node scripts/sql.mjs "select * from public.putar_roda('KODE','TOKEN','HOST_TOKEN');"
node scripts/sql.mjs "select public.giliran_berikutnya('KODE','HOST_TOKEN');"
node scripts/sql.mjs "select * from public.putar_roda('KODE','TOKEN','HOST_TOKEN');"
node scripts/sql.mjs "select public.giliran_berikutnya('KODE','HOST_TOKEN');"
node scripts/sql.mjs "select * from public.putar_roda('KODE','TOKEN','HOST_TOKEN');"
node scripts/sql.mjs "select status from public.rooms where kode = 'KODE';"
```

Expected: dua putaran pertama mengembalikan satu baris berisi pertanyaan; putaran ketiga mengembalikan **nol baris** — bukan galat — dan `status` terakhir bernilai `selesai`.

Kalau rangkaian ini perlu diulang, tulis `scripts/verifikasi-kolam.mjs` mengikuti pola `scripts/verifikasi-giliran.mjs` yang sudah ada, supaya sekali jalan.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0007_opsi_dan_kolam.sql
git commit -m "feat: opsi room dan kolam yang menyusut sampai sesi selesai"
```

---

### Task 4: Layar penjelajahan bank dan pembuatan room

**Files:**
- Create: `src/components/PenjelajahBank.tsx`
- Modify: `src/lib/room.ts` (tanda tangan `buatRoom` versi opsi)
- Modify: `src/app/buat/page.tsx` (rombak total)
- Modify: `src/app/room/[kode]/page.tsx` (sisa pertanyaan, tampilan selesai, kolam tersisa di roda)
- Delete: `src/data/contoh-pertanyaan.ts`

**Interfaces:**
- Consumes: `kelompokkanBank`, `idDiTema`, `idDiSubTema` (Task 2); `keadaanCentang`, `alihkan` (Task 2); `buat_room` versi opsi (Task 3)
- Produces:
  - `type ButirPertanyaan = { teks: string; sumber: 'bank' | 'custom'; bankId: string | null }`
  - `buatRoom(namaHost: string, pertanyaan: ButirPertanyaan[], opsi: { buangTerpakai: boolean; izinkanJoinTelat: boolean }): Promise<{ kode: string; identitas: Identitas }>`

- [ ] **Step 1: Ubah `buatRoom`**

Di `src/lib/room.ts`, ganti fungsi `buatRoom` dan tambahkan tipenya:

```typescript
export type ButirPertanyaan = {
  teks: string
  sumber: 'bank' | 'custom'
  bankId: string | null
}

export async function buatRoom(
  namaHost: string,
  pertanyaan: ButirPertanyaan[],
  opsi: { buangTerpakai: boolean; izinkanJoinTelat: boolean },
): Promise<{ kode: string; identitas: Identitas }> {
  const { data, error } = await buatKlienSupabase()
    .rpc('buat_room', {
      p_nama_host: namaHost,
      p_pertanyaan: pertanyaan,
      p_buang_terpakai: opsi.buangTerpakai,
      p_izinkan_join_telat: opsi.izinkanJoinTelat,
    })
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

- [ ] **Step 2: Buat komponen penjelajah bank**

Buat `src/components/PenjelajahBank.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { BANK } from '@/data/bank-pertanyaan'
import { idDiSubTema, idDiTema, kelompokkanBank } from '@/lib/bank'
import { alihkan, keadaanCentang, type KeadaanCentang } from '@/lib/pilihan'

const POHON = kelompokkanBank(BANK)

function Kotak({ keadaan }: { keadaan: KeadaanCentang }) {
  const tanda = keadaan === 'penuh' ? '✓' : keadaan === 'sebagian' ? '–' : ''
  return (
    <span
      aria-hidden
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 text-sm font-bold ${
        keadaan === 'kosong'
          ? ''
          : 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
      }`}
    >
      {tanda}
    </span>
  )
}

export function PenjelajahBank({
  terpilih,
  setTerpilih,
}: {
  terpilih: Set<string>
  setTerpilih: (baru: Set<string>) => void
}) {
  const [temaTerbuka, setTemaTerbuka] = useState<string | null>(null)
  const [subTerbuka, setSubTerbuka] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-2">
      {POHON.map((tema) => {
        const idTema = idDiTema(tema)
        const terbuka = temaTerbuka === tema.nama

        return (
          <div key={tema.nama} className="rounded-xl border-2">
            <div className="flex items-center gap-2 p-3">
              <button
                type="button"
                aria-label={`Pilih semua di tema ${tema.nama}`}
                onClick={() => setTerpilih(alihkan(idTema, terpilih))}
                className="flex min-h-[44px] items-center"
              >
                <Kotak keadaan={keadaanCentang(idTema, terpilih)} />
              </button>
              <button
                type="button"
                onClick={() => setTemaTerbuka(terbuka ? null : tema.nama)}
                className="flex min-h-[44px] flex-1 items-center justify-between text-left font-bold"
              >
                <span>{tema.nama}</span>
                <span className="text-sm font-normal opacity-60">
                  {idTema.filter((id) => terpilih.has(id)).length}/{idTema.length}
                  <span className="ml-2">{terbuka ? '▾' : '▸'}</span>
                </span>
              </button>
            </div>

            {terbuka && (
              <div className="border-t">
                {tema.subTema.map((sub) => {
                  const idSub = idDiSubTema(sub)
                  const kunciSub = `${tema.nama}/${sub.nama}`
                  const subDibuka = subTerbuka === kunciSub

                  return (
                    <div key={sub.nama} className="border-b last:border-b-0">
                      <div className="flex items-center gap-2 py-2 pl-6 pr-3">
                        <button
                          type="button"
                          aria-label={`Pilih semua di sub-tema ${sub.nama}`}
                          onClick={() => setTerpilih(alihkan(idSub, terpilih))}
                          className="flex min-h-[44px] items-center"
                        >
                          <Kotak keadaan={keadaanCentang(idSub, terpilih)} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubTerbuka(subDibuka ? null : kunciSub)}
                          className="flex min-h-[44px] flex-1 items-center justify-between text-left"
                        >
                          <span>{sub.nama}</span>
                          <span className="text-sm opacity-60">
                            {idSub.filter((id) => terpilih.has(id)).length}/{idSub.length}
                            <span className="ml-2">{subDibuka ? '▾' : '▸'}</span>
                          </span>
                        </button>
                      </div>

                      {subDibuka && (
                        <ul className="pb-2 pl-12 pr-3">
                          {sub.pertanyaan.map((p) => (
                            <li key={p.id}>
                              <button
                                type="button"
                                onClick={() => setTerpilih(alihkan([p.id], terpilih))}
                                className="flex min-h-[44px] w-full items-center gap-2 py-1 text-left text-sm"
                              >
                                <Kotak keadaan={keadaanCentang([p.id], terpilih)} />
                                <span>{p.teks}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Rombak layar buat room**

Ganti seluruh isi `src/app/buat/page.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { PenjelajahBank } from '@/components/PenjelajahBank'
import { BANK } from '@/data/bank-pertanyaan'
import { simpanIdentitas } from '@/lib/identitas'
import { namaValid, rapikanNama } from '@/lib/nama'
import { buatRoom, type ButirPertanyaan } from '@/lib/room'

export default function BuatRoom() {
  const router = useRouter()
  const [nama, setNama] = useState('')
  const [terpilih, setTerpilih] = useState<Set<string>>(new Set())
  const [tulisSendiri, setTulisSendiri] = useState('')
  const [buangTerpakai, setBuangTerpakai] = useState(true)
  const [izinkanJoinTelat, setIzinkanJoinTelat] = useState(true)
  const [mengirim, setMengirim] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  const pertanyaanSendiri = useMemo(
    () => tulisSendiri.split('\n').map((b) => b.trim()).filter(Boolean),
    [tulisSendiri],
  )
  const totalTerpilih = terpilih.size + pertanyaanSendiri.length

  async function kirim() {
    const rapi = rapikanNama(nama)
    if (!namaValid(rapi)) {
      setGalat('Nama wajib diisi, maksimal 20 karakter.')
      return
    }
    if (totalTerpilih === 0) {
      setGalat('Pilih minimal satu pertanyaan.')
      return
    }

    const butir: ButirPertanyaan[] = [
      ...BANK.filter((p) => terpilih.has(p.id)).map((p) => ({
        teks: p.teks,
        sumber: 'bank' as const,
        bankId: p.id,
      })),
      ...pertanyaanSendiri.map((teks) => ({
        teks,
        sumber: 'custom' as const,
        bankId: null,
      })),
    ]

    setMengirim(true)
    setGalat(null)
    try {
      const { kode, identitas } = await buatRoom(rapi, butir, {
        buangTerpakai,
        izinkanJoinTelat,
      })
      simpanIdentitas(kode, identitas)
      router.push(`/room/${kode}`)
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal membuat room')
      setMengirim(false)
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6 pb-28">
      <h1 className="text-2xl font-bold">Buat Room</h1>

      <label className="flex flex-col gap-2">
        <span className="text-sm opacity-70">Nama kamu</span>
        <input
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          maxLength={20}
          className="min-h-[48px] rounded-lg border-2 px-3 text-lg"
        />
      </label>

      <section>
        <h2 className="mb-2 font-semibold">Pilih pertanyaan</h2>
        <PenjelajahBank terpilih={terpilih} setTerpilih={setTerpilih} />
      </section>

      <label className="flex flex-col gap-2">
        <span className="text-sm opacity-70">
          Tulis pertanyaan sendiri (satu per baris)
        </span>
        <textarea
          value={tulisSendiri}
          onChange={(e) => setTulisSendiri(e.target.value)}
          rows={3}
          className="rounded-lg border-2 p-3"
        />
      </label>

      <section className="flex flex-col gap-3">
        <label className="flex min-h-[44px] items-center justify-between gap-3">
          <span>Pertanyaan yang sudah keluar dibuang</span>
          <input
            type="checkbox"
            checked={buangTerpakai}
            onChange={(e) => setBuangTerpakai(e.target.checked)}
            className="h-6 w-6"
          />
        </label>
        <label className="flex min-h-[44px] items-center justify-between gap-3">
          <span>Boleh bergabung setelah sesi dimulai</span>
          <input
            type="checkbox"
            checked={izinkanJoinTelat}
            onChange={(e) => setIzinkanJoinTelat(e.target.checked)}
            className="h-6 w-6"
          />
        </label>
      </section>

      {galat && <p className="text-sm text-red-600">{galat}</p>}

      <div className="fixed inset-x-0 bottom-0 border-t bg-white p-4 dark:bg-black">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <span className="text-sm opacity-70">{totalTerpilih} terpilih</span>
          <button
            type="button"
            onClick={kirim}
            disabled={mengirim}
            className="min-h-[52px] flex-1 rounded-xl bg-black font-bold text-white disabled:opacity-40 dark:bg-white dark:text-black"
          >
            {mengirim ? 'Membuat…' : 'Buat Room'}
          </button>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Tampilkan sisa pertanyaan dan tampilan sesi selesai**

Di `src/app/room/[kode]/page.tsx`, sisipkan penanganan status `selesai` **sebelum** blok ruang tunggu:

```tsx
  if (room.status === 'selesai') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-5xl">🎉</p>
        <h1 className="text-3xl font-bold">Sesi selesai</h1>
        <p className="opacity-70">Pertanyaannya sudah habis. Terima kasih!</p>
      </main>
    )
  }
```

Lalu di blok sesi berjalan, ganti perhitungan kolam dan tambahkan penghitung sisa. Ganti baris `const indeksTerpilih = …` menjadi:

```tsx
  const kolamTampil = room.opsiBuangTerpakai
    ? kolam.filter((p) => !p.sudahKeluar || p.id === putaran?.roomQuestionId)
    : kolam
  const indeksTerpilih = putaran
    ? kolamTampil.findIndex((p) => p.id === putaran.roomQuestionId)
    : -1
```

Ganti `daftar={kolam.map((p) => p.teks)}` menjadi `daftar={kolamTampil.map((p) => p.teks)}`, lalu sisipkan penghitung tepat di bawah komponen `<Roda …/>`:

```tsx
      {room.opsiBuangTerpakai && (
        <p className="text-center text-sm opacity-60">
          Sisa {kolam.filter((p) => !p.sudahKeluar).length} pertanyaan
        </p>
      )}
```

Pertanyaan yang baru saja keluar sengaja tetap ditampilkan di roda pada putaran itu — kalau langsung hilang, roda akan melompat berubah bentuk tepat saat orang sedang melihat hasilnya.

- [ ] **Step 5: Hapus pertanyaan contoh yang sudah tidak dipakai**

```bash
rm src/data/contoh-pertanyaan.ts
```

Run: `pnpm build`
Expected: bersih. Kalau ada galat impor `contoh-pertanyaan`, ada berkas yang masih memakainya — hapus impornya di sana.

- [ ] **Step 6: Uji alur penuh di browser**

Run: `pnpm dev`

1. Buat Room: centang satu **tema** penuh, buka tema lain lalu centang satu **sub-tema**, buka satu sub-tema lagi lalu centang **satu pertanyaan**. Tambah satu pertanyaan tulis sendiri.
2. Perhatikan penghitung di bilah bawah.

Expected: angkanya cocok dengan jumlah pertanyaan yang tercentang plus satu.

3. Buat room, masuk dari jendela kedua, mulai sesi, putar sampai habis.

Expected: penghitung "Sisa N pertanyaan" turun tiap putaran, dan saat habis semua layar berpindah ke tampilan **Sesi selesai**.

- [ ] **Step 7: Uji, build, commit, deploy**

```bash
pnpm test && pnpm build
git add -A
git commit -m "feat: penjelajah bank, opsi room, dan tampilan sesi selesai"
pnpm dlx vercel@latest --prod
```

---

## Definisi Selesai Potongan 5

1. `pnpm test` lulus seluruhnya, tidak ada yang gagal atau di-skip — termasuk **tujuh** penjaga integritas bank (enam struktural, satu penjaga nilai). Jumlahnya bertambah dari 62 uji di akhir Potongan 4. `pnpm build` bersih.
2. Bank berisi 300–450 pertanyaan, tiap sub-tema dari taksonomi terisi 10–13, tanpa id maupun teks kembar.
3. Layar buat room bisa mencentang per tema, per sub-tema, dan per pertanyaan; penghitung terpilih akurat.
4. Menekan tema yang setengah tercentang **menambah sisanya**, bukan mengosongkan.
5. Pertanyaan tulis sendiri ikut masuk kolam dan bisa keluar di roda.
6. Dengan opsi buang-terpakai menyala, penghitung sisa turun tiap putaran dan sesi berpindah ke tampilan selesai saat habis, di semua layar.
7. `src/data/contoh-pertanyaan.ts` sudah tidak ada.

---

## Catatan Perubahan

Rencana ini ditulis sebelum Potongan 1–4 dikerjakan. Setelah keempatnya selesai, isinya diselaraskan dengan kenyataan repo. Yang berubah dan alasannya:

1. **Bank dan taksonomi jadi berbahasa Inggris.** `CLAUDE.md` diperbarui setelah rencana ini ditulis: seluruh antarmuka berbahasa Inggris, dan teks pertanyaan berikut nama tema ikut tampil di layar peserta. Sepuluh tema dan 34 sub-tema diterjemahkan (`ROHANI → SPIRITUAL`, `PENGAKUAN → CONFESSIONS`, dan seterusnya); jumlah dan strukturnya tidak berubah.

2. **Aturan nilai ditambahkan ke Task 1, berikut uji ke-7 sebagai penegaknya.** Bank ini dipakai di sesi fellowship. Tidak boleh ada muatan seksual, dan tidak boleh ada pertanyaan yang mengajak orang membanggakan atau meromantisasi dosa. Uji daftar kata terlarang dipasang supaya aturan itu punya penegak teknis, bukan cuma niat baik penulisnya.

3. **Migrasi `0005_opsi_dan_kolam.sql` jadi `0007_opsi_dan_kolam.sql`.** Potongan 4 sudah memakai `0005_giliran.sql` dan `0006_opsi_room.sql`.

4. **`ubah_opsi_join_telat` dihapus dari lingkup Potongan 5.** Potongan 4 sudah mengerjakannya di `0006_opsi_room.sql`. Yang tersisa di sini cuma `opsi_buang_terpakai`.

5. **Pesan galat SQL diterjemahkan ke Inggris.** Rencana lama menulis `raise exception 'room tidak ditemukan'`. Pesan fungsi database ikut tampil di layar peserta, jadi ia antarmuka — aturan `CLAUDE.md` berlaku penuh. Migrasi `0003_pesan_antarmuka_inggris.sql` sudah menetapkan kalimat bakunya; Task 3 memakai kalimat yang sama.

6. **`search_path` jadi `public, extensions`.** Rencana lama menulis `set search_path = public`, padahal `gen_random_bytes` tinggal di skema `extensions`. Fungsi akan gagal saat dipanggil, bukan saat dibuat.

7. **Semua acuan kolom diawali nama tabelnya.** Klausa `returns table` membuat `teks`, `kode`, dan `room_id` jadi variabel keluaran; acuan tanpa awalan ditolak Postgres sebagai ambigu. Ini galat yang sudah pernah menjaring fungsi yang sama di Potongan 4.

8. **Penanganan `unique_violation` pada `insert into spins` dikembalikan.** Rencana lama menulis insert telanjang, yang berarti dua putaran bersamaan memunculkan galat Postgres mentah, bukan kalimat yang bisa dibaca. Kunci anti dua putaran adalah keputusan yang tidak boleh dilonggarkan.

9. **Kolam habis tidak lagi `raise exception`.** Rencana lama menutup sesi lalu melempar galat di baris berikutnya — padahal exception membatalkan seluruh transaksi, termasuk penutupan sesi itu sendiri. Sesi tidak akan pernah benar-benar tertutup. Sekarang fungsi mengembalikan nol baris, dan klien membacanya sebagai isyarat sesi selesai.

10. **Verifikasi pindah dari SQL Editor ke CLI.** `npx supabase db push` dan `node scripts/sql.mjs` menggantikan langkah tempel-dan-Run di dashboard, supaya seluruh task bisa dijalankan tanpa tangan manusia.

11. **Angka uji mati diganti patokan relatif.** Rencana lama mematok "53 uji". Akhir Potongan 4 sudah 62 uji, jadi angka itu tidak lagi bermakna. Yang dijaga sekarang: tidak ada uji yang gagal atau di-skip.

12. **Step 6 Task 1 ditandai tidak menghalangi.** Pembacaan manual atas seluruh bank oleh pemilik project dipindah ke akhir Fase 1, bersama uji HP.

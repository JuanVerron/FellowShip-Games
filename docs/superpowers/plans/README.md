# Urutan Pengerjaan Fellowship Games — Fase 1

Enam potongan, dikerjakan berurutan. Tiap potongan punya berkas rencananya sendiri dan **satu sesi Claude Code sendiri**. Jangan mulai potongan berikutnya sebelum "Definisi Selesai" potongan sekarang terpenuhi seluruhnya.

## Sebelum sesi pertama

Ini yang harus disiapkan sendiri, tidak bisa diwakilkan:

- [x] Akun [supabase.com](https://supabase.com) (login GitHub), organization paket **Free**
- [x] Project Supabase bernama `fellowship-games`, region **Southeast Asia (Singapore)**, password database disimpan
- [x] `Project URL` dan `anon public` key dari **Settings → API**
- [x] Akun [vercel.com](https://vercel.com) (login GitHub), paket **Hobby**, tanpa metode pembayaran

Detailnya ada di bagian "Prasyarat Manual" di rencana Potongan 1.

## Enam potongan

| # | Berkas rencana | Hasil yang bisa dibuka dan diuji | Selesai |
|---|---|---|---|
| 1 | `2026-08-28-potongan-1-tulang-punggung-online.md` | URL publik hidup di Vercel, tersambung Supabase, cron anti-pause jalan | [x] |
| 2 | `2026-08-28-potongan-2-room-dan-peserta.md` | Buat room dapat kode; orang lain masuk; daftar peserta hidup di semua HP | [x] |
| 3 | `2026-08-28-potongan-3-roda-serentak.md` | Roda berputar dan berhenti di pertanyaan yang sama di semua layar | [ ] |
| 4 | `2026-08-28-potongan-4-giliran-dan-aturan-sesi.md` | Urutan diacak, tombol terkunci per giliran, host memindah giliran | [ ] |
| 5 | `2026-08-28-potongan-5-bank-penuh-dan-pemilihan.md` | Bank 300–450 pertanyaan, accordion pemilihan, opsi room, sesi selesai | [ ] |
| 6 | `2026-08-28-potongan-6-penghalusan-sesi.md` | Sisipan saat sesi, pemulihan setelah HP terkunci, tampilan HP rapi | [ ] |

Centang kolom terakhir setelah semua butir "Definisi Selesai" di rencana itu terpenuhi.

## Cara memulai tiap sesi

Buka sesi Claude Code **baru** di folder ini, lalu tempel satu baris ini — ganti nomornya:

```
Kerjakan docs/superpowers/plans/2026-08-28-potongan-1-tulang-punggung-online.md
```

Sesi baru penting karena `CLAUDE.md` terbaca bersih dari awal dan konteks potongan sebelumnya tidak ikut membebani.

Kalau sebuah potongan terlalu panjang untuk satu sesi, berhenti di batas task (tiap task berakhir dengan commit), lalu di sesi berikutnya tempel:

```
Lanjutkan docs/superpowers/plans/<berkas>.md dari Task <n>
```

## Kalau rencana ternyata meleset

Rencana ini ditulis sebelum satu baris kode pun ada, jadi sebagian tebakan pasti keliru — nama berkas bawaan yang berbeda, versi pustaka yang bergeser, galat yang tidak terduga.

Yang benar saat itu terjadi: **perbaiki keadaannya, lalu perbarui berkas rencananya di commit yang sama.** Jangan membiarkan rencana bercerita beda dari kode, dan jangan melonggarkan uji supaya lolos. Kalau perubahannya menyentuh keputusan di `PRD.md` atau `CLAUDE.md`, perbarui keduanya berikut alasannya di bagian Catatan Perubahan.

## Setelah Potongan 6

Fase 1 selesai. Jalankan satu sesi fellowship sungguhan sebelum menyentuh apa pun dari Fase 2. Urutan Fase 2 memang sengaja belum ditetapkan — sesi pertama yang berhak menentukannya.

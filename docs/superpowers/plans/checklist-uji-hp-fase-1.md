# Checklist Uji HP — penutup Fase 1

Potongan 5 dan 6 dikerjakan berurutan dalam satu sesi loop tanpa jeda uji di antaranya, atas keputusan pemilik project pada 2026-08-29. Uji HP dilakukan sekali di sini, untuk keduanya sekaligus.

**Ini syarat mati Fase 1.** Ia ditunda, bukan dihapus. Jangan menyentuh apa pun dari Fase 2 sebelum seluruh butir di bawah tercentang.

## Yang sudah dijamin tanpa kamu

Supaya kamu tahu apa yang **tidak** perlu diperiksa ulang:

- `pnpm test` — 96 uji, termasuk tujuh penjaga integritas bank dan penjaga nilai yang menolak daftar kata terlarang.
- `pnpm lint` dan `pnpm build` bersih.
- `node scripts/verifikasi-kolam.mjs` — 10 pemeriksaan. Kolam menyusut, sesi tertutup saat habis, opsi buang-terpakai mati berarti kolam tak pernah habis.
- `node scripts/verifikasi-sisipan.mjs` — 7 pemeriksaan. Sisipan masuk ekor kolam, peserta biasa ditolak database, validasi teks, dan penolakan setelah sesi selesai.
- Halaman `/buat` merender 374 pertanyaan dalam 10 tema dengan kotak centang ber-`aria-checked`.
- `maximum-scale=5` dan `theme-color` dua mode hadir di kerangka halaman.
- `src/components/Roda.tsx` memakai `motion-safe:`, jadi "kurangi animasi" melewati transisinya.

Ketiga skrip di atas bisa kamu jalankan ulang kapan saja.

## Bagian A — yang tidak bisa diuji agen

Ekstensi Chrome tidak tersambung di mesin tempat loop berjalan, jadi tidak satu pun langkah berikut pernah dijalankan.

- [ ] **A1. Penghitung terpilih akurat** (Potongan 5, Task 4, Step 6)
  Di `/buat`: centang satu **tema** penuh, buka tema lain lalu centang satu **sub-tema**, buka satu sub-tema lagi lalu centang **satu pertanyaan**. Tambah satu pertanyaan tulis sendiri.
  Harapan: angka di bilah bawah = jumlah pertanyaan yang tercentang + 1.

- [ ] **A2. Tema setengah tercentang menambah sisanya**
  Centang beberapa pertanyaan satuan di dalam satu tema, lalu tekan kotak centang temanya.
  Harapan: sisanya **ikut tercentang**, bukan semuanya terhapus.

- [ ] **A3. Sisipan di tengah sesi** (Potongan 6, Task 4, Step 4)
  Dua jendela, mulai sesi, putar sekali. Di jendela host tekan **+ Add a question**, ketik satu pertanyaan, tekan **Add to pool**.
  Harapan: pesan "In the pool for the next spin.", penghitung sisa naik satu di **kedua** layar, roda bertambah satu segmen. Lalu Next turn dan putar beberapa kali — sisipan itu ikut berpeluang keluar.

- [ ] **A4. Ajakan masuk** (Potongan 6, Task 4, Step 5)
  Buka `/room/KODE` di jendela penyamaran yang belum pernah bergabung.
  Harapan: "You have not joined this room yet." berikut tombol **Join this room** — bukan tombol PUTAR yang mati tanpa keterangan.

- [ ] **A5. Pemulihan setelah HP terkunci** (Potongan 6, Task 3, Step 2)
  Di jendela B, pindah ke tab lain **beberapa menit** sungguhan — bukan beberapa detik. Sementara itu di jendela A tekan PUTAR lalu Next turn. Kembali ke jendela B.
  Harapan: jendela B langsung menampilkan pertanyaan dan giliran yang benar, tanpa dimuat ulang manual. Ini yang paling penting diuji dengan HP sungguhan yang benar-benar dikunci, karena browser HP menangguhkan tab lebih agresif daripada tab desktop yang disembunyikan.

- [ ] **A6. Lebar 360px** (Potongan 6, Task 4, Step 6)
  Telusuri semua layar: depan, buat room, masuk, ruang tunggu, sesi berjalan, sesi selesai, dan layar belum-bergabung.
  Harapan: tidak ada gulir mendatar di mana pun, tidak ada yang terpotong, semua sasaran sentuh minimal 44px, teks pertanyaan terbaca besar.

- [ ] **A7. Kurangi animasi**
  Nyalakan "kurangi gerak" di setelan HP, lalu putar roda.
  Harapan: hasilnya tetap muncul, tanpa putaran panjang.

## Bagian B — pembacaan bank

- [ ] **B1. Baca seluruh 374 pertanyaan sekali** (Potongan 5, Task 1, Step 6)
  Buka `src/data/bank-pertanyaan.ts` dan baca semuanya. Hapus yang terasa tidak pas untuk kelompokmu — terlalu menusuk, terlalu pribadi untuk orang yang belum akrab, atau sekadar tidak enak dibaca.

  Setelah menghapus, jalankan `pnpm test src/data`. Kalau ada sub-tema yang jatuh di bawah 10 pertanyaan, tambahkan gantinya.

  Uji penjaga nilai hanya menolak daftar kata terlarang. Ia lantai, bukan langit-langit — selera tetap keputusanmu.

## Bagian C — Definisi Selesai Potongan 6

- [ ] C1. `pnpm test` lulus seluruhnya, `pnpm build` bersih.
- [ ] C2. Host menyisipkan pertanyaan di tengah sesi; ia masuk kolam, terlihat di semua layar, dan ikut undian putaran berikutnya — tidak pernah dipaksa keluar seketika.
- [ ] C3. Peserta bukan host tidak punya jalan menyisipkan pertanyaan, termasuk lewat pemanggilan langsung ke database.
- [ ] C4. HP dikunci beberapa menit lalu dibuka: layar kembali ke giliran dan pertanyaan yang benar tanpa mengetik nama ulang.
- [ ] C5. Membuka tautan room tanpa pernah bergabung memunculkan ajakan masuk, bukan tombol mati.
- [ ] C6. Pada lebar 360px tidak ada gulir mendatar di layar mana pun.
- [ ] C7. Dengan "kurangi animasi" menyala, roda tetap memberi hasil tanpa putaran panjang.

## Kalau ada yang gagal

Perbaiki keadaannya, lalu perbarui berkas rencana yang bersangkutan di commit yang sama. Jangan melonggarkan uji supaya lolos.

## Setelah semuanya tercentang

Fase 1 selesai. Jalankan satu sesi fellowship sungguhan sebelum menyentuh apa pun dari Fase 2 — urutan Fase 2 memang sengaja belum ditetapkan, karena kenyataan sesi pertama yang berhak menentukannya.

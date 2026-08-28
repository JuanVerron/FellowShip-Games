# Fellowship Games

Web responsive untuk sesi fellowship: roda pertanyaan diputar bersama, semua peserta ikut dari HP masing-masing lewat kode room, tanpa akun. Roulette adalah game pertama dari beberapa game yang direncanakan.

Detail lengkap ada di `PRD.md`. Rencana kerja langkah demi langkah ada di `docs/superpowers/plans/` — urutannya di `README.md` folder itu. Baca keduanya sebelum mulai potongan kerja baru.

## Keputusan yang tidak boleh diubah diam-diam

- **Bank pertanyaan adalah berkas statis di repo, bukan tabel database.** Alasan: bank sengaja hanya bisa diubah developer. Kalau dipindah ke database, aturan itu jadi tidak punya penegak teknis.
- **Teks pertanyaan disalin ke `room_questions`, tidak cuma dirujuk lewat id bank.** Alasan: bank berubah lewat deploy, dan room yang cuma menyimpan id bisa berubah teks atau kehilangan pertanyaan di tengah sesi.
- **Sinkronisasi lewat Supabase Realtime langsung dari browser, bukan polling ke server.** Alasan: polling 10 peserta selama 1 jam ≈ 36.000 pemanggilan fungsi per sesi; jatah gratis Vercel 1 juta/bulan habis dalam beberapa kali kumpul.
- **Kunci anti dua putaran bersamaan pakai batasan unik `(room_id, nomor_giliran)` di database.** Alasan: penjagaan di kode aplikasi selalu bisa kalah oleh dua permintaan yang datang nyaris bersamaan.
- **Pertanyaan sisipan dari host masuk kolam untuk putaran berikutnya, tidak bisa dipaksa keluar sekarang.** Alasan: kalau host bisa mengarahkan pertanyaan ke orang tertentu, roda kehilangan maknanya.
- **Peserta yang telat bergabung ditaruh di ekor antrean, bukan disisipkan acak.** Alasan: penyisipan acak bisa memberi giliran kedua ke orang yang sudah lewat sementara ada yang belum sama sekali.
- **Urutan giliran diacak tepat sekali saat host menekan Mulai, lalu tetap.** Alasan: peserta harus bisa melihat kapan gilirannya datang.
- **Penguncian tombol putar ditegakkan di server, bukan cuma dengan `disabled` di browser.**

## Batasan wajib yang gampang kelewat

- **Nol biaya adalah syarat mati.** Jangan pernah sambungkan metode pembayaran ke Vercel — akun Hobby berhenti melayani saat limit tercapai, bukan menagih, dan itulah jaminannya. Jangan tambah layanan berbayar apa pun.
- Vercel Hobby hanya untuk non-komersial. Jangan tambahkan iklan, pembayaran, atau afiliasi.
- Supabase gratis dipause setelah 7 hari tanpa aktivitas database. Vercel Cron harian yang **menulis** ke database wajib ada sejak Potongan 1, bukan ditunda. Harus menulis, bukan membaca — baca saja belum tentu dihitung sebagai aktivitas.
- Tanpa login. Kewenangan bersandar pada `host_token` dan `token` peserta di localStorage, diperiksa di fungsi database.
- Akses tulis langsung ke tabel ditutup. Semua perubahan keadaan lewat fungsi database yang memeriksa token.
- Target layar utama potret HP 360px. Sasaran sentuh minimal 44px; tombol putar jauh lebih besar.
- Animasi roda pakai transform CSS, bukan gambar per bingkai. Hormati `prefers-reduced-motion`.
- Seluruh antarmuka berbahasa Indonesia, bernada percakapan.
- Bank berstruktur tepat dua tingkat: Tema → Sub-tema. Jangan tambah tingkat ketiga atau label lintas tema.

## Sengaja TIDAK dibangun di fase ini

Jangan berinisiatif menambahkan: layar kelola bank pertanyaan di aplikasi, pencarian pertanyaan, kategori/label lintas tema, peserta menyumbang pertanyaan, riwayat sesi tersimpan, skor, pencatatan siapa menjawab apa, login, PWA, dan game selain roulette.

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS. Supabase (Postgres + Realtime). Deploy ke Vercel Hobby. Package manager: pnpm.

## Build Order

1. **Tulang punggung online** — Next.js kosong tersambung Supabase, dideploy ke Vercel dengan URL publik, plus Vercel Cron harian anti-pause. Belum ada: room, roda, bank.
2. **Room hidup berisi orang** — buat room dapat kode, masuk lewat kode + nama, daftar peserta realtime. Token host & peserta dipakai sejak sini. Belum ada: bank, roda, giliran.
3. **Roda berputar serentak** — kolam dari daftar contoh kecil di kode. Tombol putar, animasi, hasil sama di semua layar, batasan unik anti dobel. Belum ada: giliran, opsi room, bank penuh.
4. **Giliran dan aturan sesi** — urutan diacak saat Mulai, tombol terkunci per giliran (ditegakkan server), host boleh mewakili, tombol Giliran Berikutnya, join telat ke ekor. Belum ada: bank penuh, sisipan.
5. **Bank penuh dan pemilihannya** — seed 300–450 pertanyaan dua tingkat, accordion centang tema/sub-tema/satuan, tulis pertanyaan sendiri, opsi buang-terpakai + layar sesi selesai. Belum ada: sisipan saat sesi.
6. **Penghalusan sesi** — sisipan pertanyaan saat berjalan, pemulihan setelah refresh/HP terkunci, perapian tampilan potret HP.

Kerjakan berurutan. Jangan mulai potongan berikutnya sebelum potongan sekarang bisa dibuka dan diuji di HP sungguhan. Tiap potongan punya berkas rencana sendiri di `docs/superpowers/plans/`; kalau rencana meleset dari kenyataan, perbaiki keadaannya lalu perbarui berkas rencananya di commit yang sama.

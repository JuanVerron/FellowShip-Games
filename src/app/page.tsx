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

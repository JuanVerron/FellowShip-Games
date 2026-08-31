'use client'

import { useState } from 'react'
import { Tombol } from '@/components/Tombol'
import {
  PANJANG_SISIPAN_MAKS,
  pertanyaanValid,
  sisipPertanyaan,
} from '@/lib/sisipan'

/**
 * Kotak sisipan milik host, di tengah sesi yang sedang berjalan.
 *
 * Tertutup secara bawaan. Kotak yang selalu terbuka mengambil ruang layar HP
 * yang justru dibutuhkan roda dan antrean.
 */
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
  const [berhasil, setBerhasil] = useState(false)

  async function kirim() {
    if (!pertanyaanValid(teks)) {
      setBerhasil(false)
      setKabar(
        `A question needs some text, ${PANJANG_SISIPAN_MAKS} characters max.`,
      )
      return
    }

    setSibuk(true)
    setKabar(null)
    try {
      await sisipPertanyaan(kode, hostToken, teks)
      setTeks('')
      setBerhasil(true)
      // Bukan sekadar "Added". Kalimat ini yang mencegah host mengira
      // pertanyaannya akan langsung keluar, lalu bingung waktu roda memilih
      // yang lain. Sisipan memang selalu masuk undian putaran berikutnya.
      setKabar('In the pool for the next spin.')
    } catch (e) {
      setBerhasil(false)
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
        className="min-h-[44px] rounded-[var(--radius)] border-2 border-dashed border-garis-kuat px-4 text-sm font-semibold text-teks-redup transition-colors hover:border-aksi-garis hover:text-aksi-garis focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aksi-garis"
      >
        + Add a question
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius)] border-2 border-garis bg-permukaan p-3">
      <label className="flex flex-col gap-2">
        <span className="text-sm text-teks-redup">
          Goes into the pool for the next spin
        </span>
        <textarea
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          rows={2}
          maxLength={PANJANG_SISIPAN_MAKS}
          placeholder="Something you want to ask?"
          className="rounded-[var(--radius)] border-2 border-garis-kuat bg-latar p-2 text-base text-teks transition-colors placeholder:text-teks-redup focus:border-aksi-garis"
        />
      </label>

      {kabar && (
        <p
          role="status"
          aria-live="polite"
          className={`rounded-[var(--radius)] px-3 py-2 text-sm ${
            berhasil ? 'text-teks-redup' : 'bg-bahaya-lembut text-bahaya'
          }`}
        >
          {kabar}
        </p>
      )}

      <div className="flex gap-2">
        <Tombol
          type="button"
          onClick={kirim}
          disabled={sibuk}
          className="flex-1"
        >
          {sibuk ? 'Adding…' : 'Add to pool'}
        </Tombol>
        <Tombol type="button" varian="kedua" onClick={() => setTerbuka(false)}>
          Close
        </Tombol>
      </div>
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { PenjelajahBank } from '@/components/PenjelajahBank'
import { Sakelar } from '@/components/Sakelar'
import { TautanBeranda } from '@/components/TautanBeranda'
import { Tombol } from '@/components/Tombol'
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
      setGalat('Name is required, 20 characters max.')
      return
    }
    if (totalTerpilih === 0) {
      setGalat('Pick at least one question.')
      return
    }

    // Teksnya disalin ke room, bukan dirujuk lewat id bank. Bank berubah lewat
    // deploy; room yang cuma menyimpan id bisa berubah teks di tengah sesi.
    // `bankId` ikut dibawa untuk penelusuran, bukan untuk membaca teksnya.
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
      setGalat(e instanceof Error ? e.message : 'Could not create room')
      setMengirim(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6 pb-32">
      <TautanBeranda />

      <h1 className="text-2xl font-bold">Create Room</h1>

      <label className="flex flex-col gap-2">
        <span className="text-sm text-teks-redup">Your name</span>
        <input
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          maxLength={20}
          className="min-h-[52px] rounded-[var(--radius)] border-2 border-garis-kuat bg-permukaan px-3 text-lg text-teks transition-colors placeholder:text-teks-redup focus:border-aksi-garis"
        />
      </label>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Pick your questions</h2>
        <PenjelajahBank terpilih={terpilih} setTerpilih={setTerpilih} />
      </section>

      <label className="flex flex-col gap-2">
        <span className="text-sm text-teks-redup">
          Write your own, one per line
        </span>
        <textarea
          value={tulisSendiri}
          onChange={(e) => setTulisSendiri(e.target.value)}
          rows={3}
          className="rounded-[var(--radius)] border-2 border-garis-kuat bg-permukaan p-3 text-teks transition-colors placeholder:text-teks-redup focus:border-aksi-garis"
        />
      </label>

      <section className="flex flex-col gap-3">
        <Sakelar
          judul="Drop questions once they are used"
          keterangan={
            buangTerpakai
              ? 'Each question comes up once. The session ends when they run out.'
              : 'Questions can come up again. The session never runs out.'
          }
          nyala={buangTerpakai}
          onUbah={setBuangTerpakai}
        />
        <Sakelar
          judul="Let people join after the start"
          keterangan={
            izinkanJoinTelat
              ? 'Latecomers go to the back of the queue.'
              : 'Nobody can join once you start.'
          }
          nyala={izinkanJoinTelat}
          onUbah={setIzinkanJoinTelat}
        />
      </section>

      {galat && (
        <p
          role="alert"
          className="rounded-[var(--radius)] bg-bahaya-lembut px-3 py-2 text-sm text-bahaya"
        >
          {galat}
        </p>
      )}

      {/* Bilah tetap di bawah supaya penghitung dan tombol Create selalu
          terlihat, sedalam apa pun accordion digulir. */}
      <div className="fixed inset-x-0 bottom-0 border-t-2 border-garis bg-latar p-4">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <span aria-live="polite" className="text-sm tabular-nums text-teks-redup">
            {totalTerpilih} picked
          </span>
          <Tombol
            type="button"
            onClick={kirim}
            disabled={mengirim}
            className="flex-1"
          >
            {mengirim ? 'Creating…' : 'Create'}
          </Tombol>
        </div>
      </div>
    </main>
  )
}

'use client'

import Link from 'next/link'
import { use, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Roda } from '@/components/Roda'
import { TautanBeranda } from '@/components/TautanBeranda'
import { useRoom } from '@/hooks/useRoom'
import { bolehMemutar, pemilikGiliran, pesertaTerurut } from '@/lib/giliran'
import {
  bacaIdentitas,
  hapusIdentitas,
  identitasMasihSah,
  kunciIdentitas,
} from '@/lib/identitas'
import { putarRoda } from '@/lib/putaran'
import type { Peserta } from '@/lib/room'
import { giliranBerikutnya, mulaiSesi } from '@/lib/sesi'

const WARNA_STATUS = {
  tersambung: 'bg-green-500',
  menyambung: 'bg-amber-500',
  terputus: 'bg-red-500',
} as const

const TEKS_STATUS = {
  tersambung: 'Live',
  menyambung: 'Connecting…',
  terputus: 'Disconnected — reload the page',
} as const

// Penyimpanan browser hanya menyiarkan peristiwa 'storage' ke tab lain, bukan
// ke tab yang mengubahnya. Itu sudah cukup di sini: identitas hanya berubah
// saat masuk room, dan saat itu halamannya memang dimuat ulang.
function langgananPenyimpanan(beriTahu: () => void): () => void {
  window.addEventListener('storage', beriTahu)
  return () => window.removeEventListener('storage', beriTahu)
}

// Dijaga tidak pernah negatif. Pewaktu satu detik yang menghidupi `sekarang`
// dilambatkan browser saat tabnya tidak di depan, jadi begitu tab kembali dan
// data ditarik ulang, `sejak` bisa lebih baru daripada `sekarang` — dan layar
// sempat menulis "updated -22s ago".
function usiaDetik(sejak: number | null, sekarang: number): number | null {
  return sejak === null ? null : Math.max(0, Math.floor((sekarang - sejak) / 1000))
}

export default function HalamanRoom({
  params,
}: {
  params: Promise<{ kode: string }>
}) {
  const { kode } = use(params)
  const kodeBesar = kode.toUpperCase()
  const {
    room,
    peserta,
    kolam,
    putaran,
    memuat,
    galat,
    statusSaluran,
    diperbaruiPada,
  } = useRoom(kodeBesar)

  const [sibuk, setSibuk] = useState(false)
  const [pesanGalat, setPesanGalat] = useState<string | null>(null)

  // Identitas hidup di localStorage, yang tidak ada saat halaman dirender di
  // server. useSyncExternalStore memang dibuat untuk ini: render di server
  // memakai getServerSnapshot yang mengembalikan null, browser membaca nilai
  // sebenarnya, dan React menjahit keduanya tanpa hidrasi yang pecah.
  // Yang dibaca sengaja teks mentahnya, bukan objek hasil parse, karena
  // snapshot wajib stabil antar panggilan; objek baru tiap kali akan membuat
  // React merender tanpa henti.
  const identitasMentah = useSyncExternalStore(
    langgananPenyimpanan,
    () => {
      try {
        return window.localStorage.getItem(kunciIdentitas(kodeBesar))
      } catch {
        return null
      }
    },
    () => null,
  )
  const identitas = useMemo(
    () => (identitasMentah ? bacaIdentitas(kodeBesar) : null),
    [identitasMentah, kodeBesar],
  )

  // Identitas yang menunjuk peserta yang sudah tidak ada dibuang, supaya
  // orangnya bisa masuk lagi sebagai peserta baru alih-alih terjebak di room
  // yang menganggapnya bukan siapa-siapa.
  useEffect(() => {
    if (memuat || peserta.length === 0 || identitas === null) return
    if (!identitasMasihSah(identitas, peserta.map((o) => o.id))) {
      hapusIdentitas(kodeBesar)
    }
  }, [memuat, peserta, identitas, kodeBesar])

  const [sekarang, setSekarang] = useState(() => Date.now())
  useEffect(() => {
    const pewaktu = setInterval(() => setSekarang(Date.now()), 1000)
    return () => clearInterval(pewaktu)
  }, [])

  const hostToken = identitas?.hostToken ?? null
  const adalahHost = hostToken !== null

  async function jalankan(tugas: () => Promise<unknown>) {
    setSibuk(true)
    setPesanGalat(null)
    try {
      await tugas()
    } catch (e) {
      // Yang kalah adu cepat berhenti di sini, tapi tidak terjebak: siaran dari
      // putaran yang menang tetap datang lewat useRoom, jadi layarnya ikut
      // sampai di pertanyaan yang sama beberapa saat kemudian.
      setPesanGalat(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setSibuk(false)
    }
  }

  if (memuat) {
    return (
      <main className="mx-auto flex max-w-md flex-col p-6">
        <TautanBeranda />
        <p className="mt-4">Loading…</p>
      </main>
    )
  }

  if (galat || !room) {
    return (
      <main className="mx-auto flex max-w-md flex-col p-6">
        <TautanBeranda />
        <p className="mt-4 text-red-600">{galat ?? 'Room not found'}</p>
      </main>
    )
  }

  const usia = usiaDetik(diperbaruiPada, sekarang)

  const penunjukStatus = (
    <p role="status" className="mt-auto flex items-center gap-2 text-xs opacity-70">
      <span
        className={`inline-block h-2 w-2 shrink-0 rounded-full ${WARNA_STATUS[statusSaluran]}`}
        aria-hidden
      />
      <span>
        {TEKS_STATUS[statusSaluran]}
        {usia !== null && ` · updated ${usia}s ago`}
      </span>
    </p>
  )

  function barisPeserta(orang: Peserta, nomor?: number, redup = false) {
    const iniKamu = identitas?.participantId === orang.id
    const dasar = 'flex min-h-[44px] items-center justify-between gap-2 rounded-lg px-3'
    const rupa = iniKamu
      ? `${dasar} border-2 border-amber-500 bg-amber-500/10 font-semibold`
      : `${dasar} border`
    return (
      <li
        key={orang.id}
        aria-current={iniKamu ? 'true' : undefined}
        className={redup ? `${rupa} opacity-60` : rupa}
      >
        <span className="flex min-w-0 items-baseline gap-1.5">
          {nomor !== undefined && (
            <span className="shrink-0 tabular-nums opacity-50">{nomor}.</span>
          )}
          <span className="truncate">{orang.nama}</span>
          {iniKamu && (
            <span className="shrink-0 text-xs font-semibold text-amber-600 dark:text-amber-400">
              (you)
            </span>
          )}
        </span>
        {orang.adalahHost && (
          <span className="shrink-0 text-xs font-normal opacity-60">host</span>
        )}
      </li>
    )
  }

  // ——— Ruang tunggu ———
  if (room.status === 'lobby') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
        <TautanBeranda />

        <div className="text-center">
          <p className="text-sm opacity-70">Room code</p>
          <p className="font-mono text-5xl font-bold tracking-[0.3em]">{room.kode}</p>
          <p className="mt-2 text-sm opacity-70">Share this code with your friends</p>
        </div>

        <div>
          <h2 className="mb-3 font-semibold">Participants ({peserta.length})</h2>
          <ul className="flex flex-col gap-2">
            {peserta.map((orang) => barisPeserta(orang))}
          </ul>
        </div>

        {pesanGalat && (
          <p role="alert" className="text-sm text-red-600">
            {pesanGalat}
          </p>
        )}

        {adalahHost ? (
          <button
            type="button"
            disabled={sibuk}
            onClick={() => jalankan(() => mulaiSesi(kodeBesar, hostToken))}
            className="min-h-[56px] rounded-xl bg-black text-lg font-bold text-white disabled:opacity-40 dark:bg-white dark:text-black"
          >
            {sibuk ? 'Starting…' : 'Start session'}
          </button>
        ) : identitas ? (
          <p className="text-center text-sm opacity-70">
            Waiting for the host to start…
          </p>
        ) : (
          <Link
            href="/masuk"
            className="flex min-h-[56px] items-center justify-center rounded-xl border-2 text-lg font-semibold"
          >
            Join this room
          </Link>
        )}

        {penunjukStatus}
      </main>
    )
  }

  // ——— Sesi berjalan ———
  const antrean = pesertaTerurut(peserta)
  const pemilik = pemilikGiliran(peserta, room.nomorGiliranSekarang)
  const giliranku =
    pemilik !== null && pemilik.id === identitas?.participantId
  const bolehTekan = bolehMemutar({
    participantId: identitas?.participantId ?? null,
    adalahHost,
    pemilik,
  })

  // Roda diberi indeks di kolam, bukan id: yang berputar adalah posisi segmen.
  // findIndex mengembalikan -1 kalau pertanyaannya sudah tidak ada di kolam,
  // dan -1 yang lolos ke perhitungan sudut memutar roda ke arah yang salah.
  const indeksDitemukan = putaran
    ? kolam.findIndex((p) => p.id === putaran.roomQuestionId)
    : -1
  const indeksTerpilih = indeksDitemukan >= 0 ? indeksDitemukan : null
  const giliranIniSudahDiputar =
    putaran !== null && putaran.nomorGiliran === room.nomorGiliranSekarang

  // Label tombol ikut menjelaskan kewenangan yang sedang dipakai. Host yang
  // menekan di giliran orang lain membaca "SPIN FOR BUDI", supaya kewenangan
  // yang tidak biasa itu terlihat. Peserta biasa yang bukan gilirannya membaca
  // "WAITING FOR BUDI" — tombolnya toh mati, dan menuliskan "SPIN FOR BUDI" di
  // sana malah menjanjikan sesuatu yang tidak boleh dia lakukan.
  function labelPutar(): string {
    if (giliranIniSudahDiputar) return 'Already spun'
    if (sibuk) return 'Spinning…'
    if (giliranku || !pemilik) return 'SPIN'
    const siapa = pemilik.nama.toUpperCase()
    return adalahHost ? `SPIN FOR ${siapa}` : `WAITING FOR ${siapa}`
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 p-6">
      <div className="flex items-center justify-between gap-2">
        <TautanBeranda />
        <p className="font-mono text-sm tracking-[0.2em] opacity-60">{room.kode}</p>
      </div>

      <div
        className={`rounded-2xl p-4 text-center ${
          giliranku
            ? 'bg-amber-500 text-black'
            : 'border-2'
        }`}
      >
        {giliranku ? (
          <p className="text-2xl font-bold">Your turn!</p>
        ) : (
          <p className="text-lg">
            <span className="font-bold">{pemilik?.nama ?? '—'}</span>
            {pemilik ? "'s turn" : ' nobody yet'}
          </p>
        )}
      </div>

      <Roda
        daftar={kolam.map((p) => p.teks)}
        indeksTerpilih={indeksTerpilih}
        benih={putaran?.benihAnimasi ?? 0}
        nomorGiliran={putaran?.nomorGiliran ?? null}
      />

      {identitas ? (
        <button
          type="button"
          disabled={sibuk || !bolehTekan || giliranIniSudahDiputar}
          onClick={() =>
            jalankan(() => putarRoda(kodeBesar, identitas.token, hostToken))
          }
          className="min-h-[72px] rounded-2xl bg-black text-xl font-bold tracking-wide text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          {labelPutar()}
        </button>
      ) : (
        <Link
          href="/masuk"
          className="flex min-h-[72px] items-center justify-center rounded-2xl border-2 text-lg font-semibold"
        >
          Join this room to play
        </Link>
      )}

      {pesanGalat && (
        <p role="alert" className="text-center text-sm text-red-600">
          {pesanGalat}
        </p>
      )}

      {putaran && (
        <div className="rounded-2xl border-2 p-5">
          <p className="text-xs uppercase tracking-wide opacity-60">
            Question #{putaran.nomorGiliran + 1}
          </p>
          <p className="mt-2 text-2xl font-semibold leading-snug">{putaran.teks}</p>
        </div>
      )}

      {adalahHost && (
        <button
          type="button"
          disabled={sibuk}
          onClick={() => jalankan(() => giliranBerikutnya(kodeBesar, hostToken))}
          className="min-h-[52px] rounded-xl border-2 font-semibold disabled:opacity-40"
        >
          Next turn →
        </button>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold opacity-70">
          Up next ({antrean.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {antrean.map((orang, i) =>
            barisPeserta(orang, i + 1, orang.id !== pemilik?.id),
          )}
        </ul>
      </div>

      {penunjukStatus}
    </main>
  )
}

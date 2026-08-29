'use client'

import { use, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Roda } from '@/components/Roda'
import { Sakelar } from '@/components/Sakelar'
import { TautanBeranda } from '@/components/TautanBeranda'
import { Tombol, TautanTombol } from '@/components/Tombol'
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
import { giliranBerikutnya, mulaiSesi, ubahOpsiJoinTelat } from '@/lib/sesi'

const WARNA_STATUS = {
  tersambung: 'bg-hidup',
  menyambung: 'bg-menunggu',
  terputus: 'bg-putus',
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
        <p className="mt-4 rounded-[var(--radius)] bg-bahaya-lembut px-3 py-2 text-bahaya">
          {galat ?? 'Room not found'}
        </p>
      </main>
    )
  }

  const usia = usiaDetik(diperbaruiPada, sekarang)

  const penunjukStatus = (
    <p role="status" className="mt-auto flex items-center gap-2 pt-2 text-xs text-teks-redup">
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

  function barisPeserta(
    orang: Peserta,
    nomor?: number,
    giliranSekarang: boolean | null = null,
  ) {
    const iniKamu = identitas?.participantId === orang.id
    const dasar =
      'flex min-h-[48px] items-center justify-between gap-2 rounded-[var(--radius)] border-2 px-3'
    const rupa = iniKamu
      ? `${dasar} border-aksi-garis bg-aksi-lembut font-semibold`
      : `${dasar} border-garis bg-permukaan`
    return (
      <li
        key={orang.id}
        aria-current={giliranSekarang ? 'step' : undefined}
        className={giliranSekarang === false ? `${rupa} text-teks-redup` : rupa}
      >
        <span className="flex min-w-0 items-baseline gap-1.5">
          {nomor !== undefined && (
            <span className="shrink-0 tabular-nums text-teks-redup">{nomor}.</span>
          )}
          <span className="truncate">{orang.nama}</span>
          {iniKamu && (
            <span className="shrink-0 text-xs font-semibold text-aksi-garis">
              (you)
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {/* Giliran sekarang tidak boleh ditandai warna saja. Kata "now"
              membuatnya terbaca juga oleh orang yang tidak membedakan warna,
              dan oleh pembaca layar lewat aria-current. */}
          {giliranSekarang && (
            <span className="rounded-full bg-aksi px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-aksi-teks">
              now
            </span>
          )}
          {orang.adalahHost && (
            <span className="rounded-full border border-garis px-2 py-0.5 text-[11px] font-medium text-teks-redup">
              host
            </span>
          )}
        </span>
      </li>
    )
  }

  // ——— Ruang tunggu ———
  if (room.status === 'lobby') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
        <TautanBeranda />

        <div className="text-center">
          <p className="text-sm text-teks-redup">Room code</p>
          <p className="mt-1 font-mono text-5xl font-bold tracking-[0.3em] text-aksi-garis">
            {room.kode}
          </p>
          <p className="mt-2 text-sm text-teks-redup">Share this code with your friends</p>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-teks-redup">
            Participants ({peserta.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {peserta.map((orang) => barisPeserta(orang))}
          </ul>
        </div>

        {adalahHost && (
          <Sakelar
            judul="Allow joining after the start"
            keterangan={
              room.opsiIzinkanJoinTelat
                ? 'Latecomers land at the end of the queue.'
                : 'The room locks the moment you start.'
            }
            nyala={room.opsiIzinkanJoinTelat}
            disabled={sibuk}
            onUbah={(nyala) =>
              jalankan(() => ubahOpsiJoinTelat(kodeBesar, hostToken, nyala))
            }
          />
        )}

        {pesanGalat && (
          <p
            role="alert"
            className="rounded-[var(--radius)] bg-bahaya-lembut px-3 py-2 text-sm text-bahaya"
          >
            {pesanGalat}
          </p>
        )}

        {adalahHost ? (
          <Tombol
            type="button"
            ukuran="besar"
            disabled={sibuk}
            onClick={() => jalankan(() => mulaiSesi(kodeBesar, hostToken))}
          >
            {sibuk ? 'Starting…' : 'Start session'}
          </Tombol>
        ) : identitas ? (
          <p className="rounded-[var(--radius)] border-2 border-dashed border-garis px-4 py-5 text-center text-sm text-teks-redup">
            Waiting for the host to start…
          </p>
        ) : (
          <TautanTombol href="/masuk" varian="kedua" ukuran="besar">
            Join this room
          </TautanTombol>
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
        <p className="font-mono text-sm tracking-[0.2em] text-teks-redup">{room.kode}</p>
      </div>

      <div
        className={`rounded-[var(--radius)] border-2 p-4 text-center ${
          giliranku
            ? 'border-aksi-garis bg-aksi text-aksi-teks'
            : 'border-garis bg-permukaan'
        }`}
      >
        {giliranku ? (
          <p className="text-2xl font-bold">Your turn!</p>
        ) : (
          <p className="text-lg text-teks-redup">
            <span className="font-bold text-teks">{pemilik?.nama ?? '—'}</span>
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
        <Tombol
          type="button"
          ukuran="besar"
          disabled={sibuk || !bolehTekan || giliranIniSudahDiputar}
          onClick={() =>
            jalankan(() => putarRoda(kodeBesar, identitas.token, hostToken))
          }
        >
          {labelPutar()}
        </Tombol>
      ) : (
        <TautanTombol href="/masuk" varian="kedua" ukuran="besar">
          Join this room to play
        </TautanTombol>
      )}

      {pesanGalat && (
        <p
          role="alert"
          className="rounded-[var(--radius)] bg-bahaya-lembut px-3 py-2 text-center text-sm text-bahaya"
        >
          {pesanGalat}
        </p>
      )}

      {putaran && (
        <div className="rounded-[var(--radius)] border-2 border-garis bg-permukaan p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-aksi-garis">
            Question #{putaran.nomorGiliran + 1}
          </p>
          <p className="mt-2 text-2xl font-semibold leading-snug">{putaran.teks}</p>
        </div>
      )}

      {adalahHost && (
        <Tombol
          type="button"
          varian="kedua"
          disabled={sibuk}
          onClick={() => jalankan(() => giliranBerikutnya(kodeBesar, hostToken))}
        >
          Next turn →
        </Tombol>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-teks-redup">
          Up next ({antrean.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {antrean.map((orang, i) =>
            barisPeserta(orang, i + 1, orang.id === pemilik?.id),
          )}
        </ul>
      </div>

      {penunjukStatus}
    </main>
  )
}

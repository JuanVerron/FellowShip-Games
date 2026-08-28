import { TautanTombol } from '@/components/Tombol'

export default function Beranda() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-10 p-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Fellowship Games</h1>
        <p className="mt-2 text-teks-redup">Question bank roulette</p>
      </div>

      <div className="flex flex-col gap-3">
        <TautanTombol href="/buat" ukuran="besar">
          Create Room
        </TautanTombol>
        <TautanTombol href="/masuk" varian="kedua" ukuran="besar">
          Join Room
        </TautanTombol>
      </div>
    </main>
  )
}

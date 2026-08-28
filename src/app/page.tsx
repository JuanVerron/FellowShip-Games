import Link from 'next/link'

export default function Beranda() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
      <div>
        <h1 className="text-4xl font-bold">Fellowship Games</h1>
        <p className="mt-2 opacity-70">Question bank roulette</p>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/buat"
          className="flex min-h-[52px] items-center justify-center rounded-xl bg-black px-4 font-semibold text-white dark:bg-white dark:text-black"
        >
          Create Room
        </Link>
        <Link
          href="/masuk"
          className="flex min-h-[52px] items-center justify-center rounded-xl border-2 px-4 font-semibold"
        >
          Join Room
        </Link>
      </div>
    </main>
  )
}

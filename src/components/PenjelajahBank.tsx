'use client'

import { useState } from 'react'
import { BANK } from '@/data/bank-pertanyaan'
import { idDiSubTema, idDiTema, kelompokkanBank } from '@/lib/bank'
import { alihkan, keadaanCentang, type KeadaanCentang } from '@/lib/pilihan'

// Bank tidak pernah berubah selama halaman hidup, jadi pohonnya dibentuk
// sekali saat modul dimuat, bukan tiap render.
const POHON = kelompokkanBank(BANK)

/**
 * Kotak centang tiga keadaan.
 *
 * `role="checkbox"` dengan `aria-checked="mixed"` adalah pola ARIA untuk
 * keadaan sebagian. Kotak yang dibuat dari `div` plus `onClick` terlihat sama
 * tapi tidak mengumumkan apa pun ke pembaca layar.
 *
 * Keadaannya tidak disampaikan lewat warna saja: tandanya ikut berubah —
 * kosong, garis untuk sebagian, centang untuk penuh.
 */
function KotakCentang({
  keadaan,
  label,
  onKlik,
}: {
  keadaan: KeadaanCentang
  label: string
  onKlik: () => void
}) {
  const terisi = keadaan !== 'kosong'

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={keadaan === 'penuh' ? true : keadaan === 'sebagian' ? 'mixed' : false}
      aria-label={label}
      onClick={onKlik}
      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[calc(var(--radius)/2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aksi-garis"
    >
      <span
        aria-hidden
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border-2 text-sm font-bold transition-colors ${
          terisi
            ? 'border-aksi-garis bg-aksi text-aksi-teks'
            : 'border-garis-kuat bg-permukaan'
        }`}
      >
        {keadaan === 'penuh' ? '✓' : keadaan === 'sebagian' ? '–' : ''}
      </span>
    </button>
  )
}

function Penghitung({ terpilih, dari }: { terpilih: number; dari: number }) {
  return (
    <span className="text-sm tabular-nums text-teks-redup">
      {terpilih}/{dari}
    </span>
  )
}

/**
 * Accordion tema → sub-tema → pertanyaan, dengan tiga tingkat pencentangan.
 *
 * Bekerja sepenuhnya di browser: tidak ada satu pun panggilan server sampai
 * host menekan Create. Bank ikut terbundel, jadi menjelajahinya gratis.
 */
export function PenjelajahBank({
  terpilih,
  setTerpilih,
}: {
  terpilih: Set<string>
  setTerpilih: (baru: Set<string>) => void
}) {
  const [temaTerbuka, setTemaTerbuka] = useState<string | null>(null)
  const [subTerbuka, setSubTerbuka] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-2">
      {POHON.map((tema) => {
        const idTema = idDiTema(tema)
        const terbuka = temaTerbuka === tema.nama

        return (
          <div
            key={tema.nama}
            className="overflow-hidden rounded-[var(--radius)] border-2 border-garis bg-permukaan"
          >
            <div className="flex items-center gap-1 px-2 py-1">
              <KotakCentang
                keadaan={keadaanCentang(idTema, terpilih)}
                label={`Select everything in ${tema.nama}`}
                onKlik={() => setTerpilih(alihkan(idTema, terpilih))}
              />
              <button
                type="button"
                aria-expanded={terbuka}
                onClick={() => setTemaTerbuka(terbuka ? null : tema.nama)}
                className="flex min-h-[44px] flex-1 items-center justify-between gap-2 rounded-[calc(var(--radius)/2)] px-1 text-left font-bold text-teks focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aksi-garis"
              >
                <span className="min-w-0 truncate">{tema.nama}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <Penghitung
                    terpilih={idTema.filter((id) => terpilih.has(id)).length}
                    dari={idTema.length}
                  />
                  <span aria-hidden className="text-teks-redup">
                    {terbuka ? '▾' : '▸'}
                  </span>
                </span>
              </button>
            </div>

            {terbuka && (
              <div className="border-t-2 border-garis">
                {tema.subTema.map((sub) => {
                  const idSub = idDiSubTema(sub)
                  const kunciSub = `${tema.nama}/${sub.nama}`
                  const subDibuka = subTerbuka === kunciSub

                  return (
                    <div
                      key={sub.nama}
                      className="border-b border-garis last:border-b-0"
                    >
                      <div className="flex items-center gap-1 py-1 pl-5 pr-2">
                        <KotakCentang
                          keadaan={keadaanCentang(idSub, terpilih)}
                          label={`Select everything in ${sub.nama}`}
                          onKlik={() => setTerpilih(alihkan(idSub, terpilih))}
                        />
                        <button
                          type="button"
                          aria-expanded={subDibuka}
                          onClick={() => setSubTerbuka(subDibuka ? null : kunciSub)}
                          className="flex min-h-[44px] flex-1 items-center justify-between gap-2 rounded-[calc(var(--radius)/2)] px-1 text-left text-teks focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aksi-garis"
                        >
                          <span className="min-w-0 truncate">{sub.nama}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            <Penghitung
                              terpilih={idSub.filter((id) => terpilih.has(id)).length}
                              dari={idSub.length}
                            />
                            <span aria-hidden className="text-teks-redup">
                              {subDibuka ? '▾' : '▸'}
                            </span>
                          </span>
                        </button>
                      </div>

                      {subDibuka && (
                        <ul className="pb-1 pl-10 pr-2">
                          {sub.pertanyaan.map((p) => (
                            <li key={p.id}>
                              {/* Satu kontrol untuk seluruh baris, bukan kotak
                                  dan teks terpisah. Dua kontrol dengan isi yang
                                  sama membuat pembaca layar mengumumkannya dua
                                  kali. Teksnya sendiri yang jadi namanya. */}
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={terpilih.has(p.id)}
                                onClick={() => setTerpilih(alihkan([p.id], terpilih))}
                                className="flex min-h-[44px] w-full items-center gap-2 rounded-[calc(var(--radius)/2)] px-1 py-2 text-left text-sm text-teks focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aksi-garis"
                              >
                                <span
                                  aria-hidden
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border-2 text-xs font-bold transition-colors ${
                                    terpilih.has(p.id)
                                      ? 'border-aksi-garis bg-aksi text-aksi-teks'
                                      : 'border-garis-kuat bg-permukaan'
                                  }`}
                                >
                                  {terpilih.has(p.id) ? '✓' : ''}
                                </span>
                                <span>{p.teks}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

import { beforeEach, describe, expect, it } from 'vitest'
import {
  bacaIdentitas,
  hapusIdentitas,
  simpanIdentitas,
  type Identitas,
} from '@/lib/identitas'

function penyimpananPalsu(): Storage {
  const isi = new Map<string, string>()
  return {
    get length() {
      return isi.size
    },
    clear: () => isi.clear(),
    getItem: (kunci) => isi.get(kunci) ?? null,
    key: (indeks) => [...isi.keys()][indeks] ?? null,
    removeItem: (kunci) => void isi.delete(kunci),
    setItem: (kunci, nilai) => void isi.set(kunci, nilai),
  }
}

const contoh: Identitas = {
  roomId: 'r-1',
  participantId: 'p-1',
  token: 't-1',
  nama: 'Juan',
  hostToken: 'h-1',
}

describe('identitas', () => {
  let penyimpanan: Storage

  beforeEach(() => {
    penyimpanan = penyimpananPalsu()
  })

  it('mengembalikan apa yang disimpan', () => {
    simpanIdentitas('AB2CD', contoh, penyimpanan)
    expect(bacaIdentitas('AB2CD', penyimpanan)).toEqual(contoh)
  })

  it('memisahkan identitas antar room', () => {
    simpanIdentitas('AB2CD', contoh, penyimpanan)
    expect(bacaIdentitas('XY9ZQ', penyimpanan)).toBeNull()
  })

  it('mengembalikan null saat isinya rusak, bukan melempar galat', () => {
    penyimpanan.setItem('fellowship:room:AB2CD', 'bukan json')
    expect(bacaIdentitas('AB2CD', penyimpanan)).toBeNull()
  })

  it('menghapus identitas', () => {
    simpanIdentitas('AB2CD', contoh, penyimpanan)
    hapusIdentitas('AB2CD', penyimpanan)
    expect(bacaIdentitas('AB2CD', penyimpanan)).toBeNull()
  })
})

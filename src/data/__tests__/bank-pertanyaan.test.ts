import { describe, expect, it } from 'vitest'
import { BANK } from '@/data/bank-pertanyaan'

const TAKSONOMI: Record<string, string[]> = {
  SPIRITUAL: ['Faith', 'Prayer', 'Doubt', 'Calling'],
  FAMILY: ['Childhood', 'Funny Moments', 'Conflict', 'Gratitude'],
  SELF: ['Fears', 'Dreams', 'Habits', 'Weaknesses'],
  FRIENDSHIP: ['Memories', 'Trust', 'Loss'],
  LOVE: ['Feelings', 'Heartbreak', 'Hope'],
  WORK: ['Ambition', 'Failure', 'Daily Grind'],
  LIGHT: ['Food', 'Music', 'Odd Picks', 'What If'],
  PAST: ['Regrets', 'Turning Points', 'People Who Helped'],
  FUTURE: ['Plans', 'Worries', 'Legacy'],
  CONFESSIONS: ['Small Secrets', 'Awkward Moments', 'Honesty'],
}

describe('bank pertanyaan', () => {
  it('berisi antara 300 dan 450 pertanyaan', () => {
    expect(BANK.length).toBeGreaterThanOrEqual(300)
    expect(BANK.length).toBeLessThanOrEqual(450)
  })

  it('tidak punya id kembar', () => {
    const id = BANK.map((p) => p.id)
    expect(new Set(id).size).toBe(id.length)
  })

  it('tidak punya teks kembar', () => {
    const teks = BANK.map((p) => p.teks.toLowerCase().trim())
    expect(new Set(teks).size).toBe(teks.length)
  })

  it('hanya memakai tema dan sub-tema dari taksonomi', () => {
    for (const p of BANK) {
      expect(TAKSONOMI[p.tema], `tema tak dikenal: ${p.tema}`).toBeDefined()
      expect(TAKSONOMI[p.tema]).toContain(p.subTema)
    }
  })

  it('mengisi setiap sub-tema dengan 10 sampai 13 pertanyaan', () => {
    for (const [tema, daftarSub] of Object.entries(TAKSONOMI)) {
      for (const subTema of daftarSub) {
        const jumlah = BANK.filter(
          (p) => p.tema === tema && p.subTema === subTema,
        ).length
        expect(jumlah, `${tema} → ${subTema}`).toBeGreaterThanOrEqual(10)
        expect(jumlah, `${tema} → ${subTema}`).toBeLessThanOrEqual(13)
      }
    }
  })

  it('menulis semua pertanyaan sebagai kalimat tanya yang tidak kepanjangan', () => {
    for (const p of BANK) {
      expect(p.teks.endsWith('?'), p.id).toBe(true)
      expect(p.teks.length, p.id).toBeLessThan(120)
    }
  })

  // Penjaga nilai. Bank ini dipakai di sesi fellowship, jadi pertanyaannya
  // tidak boleh menggiring obrolan ke hal yang menjauhkan orang dari Tuhan.
  //
  // Daftar ini lantai, bukan langit-langit: lolos di sini tidak berarti
  // pertanyaannya pantas. Aturan nilai di rencana Task 1 yang menjaga selera,
  // dan pembacaan manusia di akhir Fase 1 tetap langkah terakhir.
  it('tidak memuat topik yang menjauhkan dari teladan Yesus', () => {
    const TERLARANG = [
      'sex', 'sexy', 'sexual', 'porn', 'nude', 'naked', 'hookup',
      'drunk', 'drunken', 'booze', 'alcohol', 'drug', 'drugs', 'weed',
      'gamble', 'gambling', 'affair', 'affairs', 'revenge',
    ]
    const pola = new RegExp(`\b(${TERLARANG.join('|')})\b`, 'i')
    for (const p of BANK) {
      const cocok = p.teks.match(pola)
      expect(cocok?.[0], `${p.id}: "${p.teks}"`).toBeUndefined()
    }
  })
})

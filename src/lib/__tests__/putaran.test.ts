import { describe, expect, it } from 'vitest'
import { keKolam, kePutaran } from '@/lib/putaran'

describe('keKolam', () => {
  it('menerjemahkan nama kolom snake_case jadi camelCase', () => {
    expect(
      keKolam({ id: 'q-1', teks: 'Halo?', urutan: 3, sudah_keluar: true }),
    ).toEqual({ id: 'q-1', teks: 'Halo?', urutan: 3, sudahKeluar: true })
  })
})

describe('kePutaran', () => {
  it('membaca relasi bertingkat yang datang sebagai objek', () => {
    expect(
      kePutaran({
        room_question_id: 'q-1',
        nomor_giliran: 2,
        benih_animasi: 7,
        room_questions: { teks: 'Halo?' },
      }),
    ).toEqual({
      roomQuestionId: 'q-1',
      teks: 'Halo?',
      nomorGiliran: 2,
      benihAnimasi: 7,
    })
  })

  it('membaca relasi bertingkat yang datang sebagai larik', () => {
    expect(
      kePutaran({
        room_question_id: 'q-1',
        nomor_giliran: 2,
        benih_animasi: 7,
        room_questions: [{ teks: 'Halo?' }],
      }).teks,
    ).toBe('Halo?')
  })

  it('tidak meledak saat relasinya kosong', () => {
    expect(
      kePutaran({
        room_question_id: 'q-1',
        nomor_giliran: 0,
        benih_animasi: 0,
        room_questions: null,
      }).teks,
    ).toBe('')
  })
})

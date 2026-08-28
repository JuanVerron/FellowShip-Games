import { describe, expect, it } from 'vitest'
import { kePeserta, keRoom } from '@/lib/room'

describe('keRoom', () => {
  it('menerjemahkan nama kolom snake_case jadi camelCase', () => {
    expect(
      keRoom({
        id: 'r-1',
        kode: 'AB2CD',
        status: 'lobby',
        nomor_giliran_sekarang: 0,
        opsi_buang_terpakai: true,
        opsi_izinkan_join_telat: false,
      }),
    ).toEqual({
      id: 'r-1',
      kode: 'AB2CD',
      status: 'lobby',
      nomorGiliranSekarang: 0,
      opsiBuangTerpakai: true,
      opsiIzinkanJoinTelat: false,
    })
  })
})

describe('kePeserta', () => {
  it('mempertahankan urutan giliran yang masih kosong', () => {
    expect(
      kePeserta({ id: 'p-1', nama: 'Juan', urutan_giliran: null, adalah_host: true }),
    ).toEqual({ id: 'p-1', nama: 'Juan', urutanGiliran: null, adalahHost: true })
  })
})

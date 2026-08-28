export type Identitas = {
  roomId: string
  participantId: string
  token: string
  nama: string
  hostToken: string | null
}

function kunciUntuk(kode: string): string {
  return `fellowship:room:${kode}`
}

function penyimpananBawaan(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function simpanIdentitas(
  kode: string,
  identitas: Identitas,
  penyimpanan: Storage | null = penyimpananBawaan(),
): void {
  try {
    penyimpanan?.setItem(kunciUntuk(kode), JSON.stringify(identitas))
  } catch {
    // Mode penyamaran atau penyimpanan penuh. Sesi tetap boleh jalan,
    // cuma tidak bisa dipulihkan setelah halaman dimuat ulang.
  }
}

export function bacaIdentitas(
  kode: string,
  penyimpanan: Storage | null = penyimpananBawaan(),
): Identitas | null {
  try {
    const mentah = penyimpanan?.getItem(kunciUntuk(kode))
    if (!mentah) return null

    const isi = JSON.parse(mentah) as Partial<Identitas>
    if (
      typeof isi.roomId !== 'string' ||
      typeof isi.participantId !== 'string' ||
      typeof isi.token !== 'string' ||
      typeof isi.nama !== 'string'
    ) {
      return null
    }

    return {
      roomId: isi.roomId,
      participantId: isi.participantId,
      token: isi.token,
      nama: isi.nama,
      hostToken: typeof isi.hostToken === 'string' ? isi.hostToken : null,
    }
  } catch {
    return null
  }
}

export function hapusIdentitas(
  kode: string,
  penyimpanan: Storage | null = penyimpananBawaan(),
): void {
  try {
    penyimpanan?.removeItem(kunciUntuk(kode))
  } catch {
    // Sama seperti simpanIdentitas: gagal menyimpan bukan alasan
    // menghentikan sesi.
  }
}

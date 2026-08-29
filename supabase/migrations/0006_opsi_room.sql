-- Sakelar opsi room milik host.
--
-- Kolomnya sudah ada sejak Potongan 2 dan sudah ditegakkan masuk_room sejak
-- Potongan 4, tapi belum pernah ada cara mengubahnya. Nilainya terkunci di
-- bawaan `true` selamanya. Fungsi ini yang membukanya.
--
-- Sengaja hanya satu opsi. `opsi_buang_terpakai` menunggu Potongan 5, karena
-- ia baru berarti bersama penghitung sisa dan layar sesi selesai.

create or replace function public.ubah_opsi_join_telat(
  p_kode text,
  p_host_token text,
  p_izinkan boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room public.rooms%rowtype;
begin
  if p_izinkan is null then
    raise exception 'That setting needs a value.';
  end if;

  select * into v_room from public.rooms
   where rooms.kode = upper(trim(p_kode)) and rooms.kedaluwarsa_pada > now();
  if not found then
    raise exception 'Room not found.';
  end if;

  -- Kewenangan host dibuktikan dengan host_token, bukan dengan tombol yang
  -- cuma disembunyikan di browser.
  if not exists (select 1 from public.room_secrets
                  where room_secrets.room_id = v_room.id
                    and room_secrets.host_token = p_host_token) then
    raise exception 'Only the host can change this setting.';
  end if;

  if v_room.status = 'selesai' then
    raise exception 'This session has already finished.';
  end if;

  update public.rooms
     set opsi_izinkan_join_telat = p_izinkan
   where rooms.id = v_room.id;

  return p_izinkan;
end;
$$;

grant execute on function public.ubah_opsi_join_telat(text, text, boolean) to anon;

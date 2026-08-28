-- Pesan yang dilempar kedua fungsi ini bukan catatan internal: PostgREST
-- meneruskannya apa adanya ke browser, dan layar Masuk menampilkannya sebagai
-- teks merah di bawah formulir. Jadi pesan-pesan ini termasuk antarmuka, dan
-- ikut aturan bahasa di CLAUDE.md.
--
-- Isi fungsinya tidak berubah selain teks pesannya.

create or replace function public.buat_room(p_nama_host text)
returns table (
  room_id uuid,
  kode text,
  host_token text,
  participant_id uuid,
  participant_token text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room_id uuid;
  v_kode text;
  v_host_token text;
  v_participant_id uuid;
  v_participant_token text;
begin
  if p_nama_host is null or length(trim(p_nama_host)) = 0
     or length(trim(p_nama_host)) > 20 then
    raise exception 'Name is required, 20 characters max.';
  end if;

  v_kode := public.buat_kode_room();
  v_host_token := encode(gen_random_bytes(24), 'hex');
  v_participant_token := encode(gen_random_bytes(24), 'hex');

  insert into public.rooms (kode) values (v_kode) returning id into v_room_id;
  insert into public.room_secrets (room_id, host_token)
    values (v_room_id, v_host_token);

  insert into public.participants (room_id, nama, adalah_host)
    values (v_room_id, trim(p_nama_host), true)
    returning id into v_participant_id;
  insert into public.participant_secrets (participant_id, token)
    values (v_participant_id, v_participant_token);

  return query select v_room_id, v_kode, v_host_token,
                      v_participant_id, v_participant_token;
end;
$$;

create or replace function public.masuk_room(p_kode text, p_nama text)
returns table (
  room_id uuid,
  participant_id uuid,
  participant_token text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room public.rooms%rowtype;
  v_participant_id uuid;
  v_token text;
begin
  if p_nama is null or length(trim(p_nama)) = 0
     or length(trim(p_nama)) > 20 then
    raise exception 'Name is required, 20 characters max.';
  end if;

  select * into v_room from public.rooms
   where kode = upper(trim(p_kode)) and kedaluwarsa_pada > now();

  if not found then
    raise exception 'Room not found.';
  end if;

  if v_room.status = 'selesai' then
    raise exception 'This session has already finished.';
  end if;

  if v_room.status = 'berjalan' and not v_room.opsi_izinkan_join_telat then
    raise exception 'This session has already started and is closed to new people.';
  end if;

  -- Kolomnya wajib diawali nama tabel. 'returns table (room_id ...)' membuat
  -- room_id jadi variabel keluaran, dan tanpa awalan ini Postgres menolak
  -- dengan 'column reference "room_id" is ambiguous'.
  if exists (select 1 from public.participants
              where participants.room_id = v_room.id
                and participants.nama = trim(p_nama)) then
    raise exception 'That name is already taken in this room.';
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');

  insert into public.participants (room_id, nama)
    values (v_room.id, trim(p_nama))
    returning id into v_participant_id;
  insert into public.participant_secrets (participant_id, token)
    values (v_participant_id, v_token);

  return query select v_room.id, v_participant_id, v_token;
end;
$$;

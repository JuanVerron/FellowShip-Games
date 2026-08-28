-- Giliran dan aturan sesi.
--
-- Kepemilikan giliran dihitung dari urutan_giliran peserta dan
-- nomor_giliran_sekarang room, bukan disimpan sebagai penunjuk yang bisa basi.

-- Pembantu bersama: siapa pemilik giliran nomor sekian di sebuah room.
create or replace function public.pemilik_giliran(p_room_id uuid, p_nomor int)
returns uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  select p.id
    from public.participants p
   where p.room_id = p_room_id and p.urutan_giliran is not null
   order by p.urutan_giliran
  offset (
    p_nomor % greatest(
      (select count(*) from public.participants
        where participants.room_id = p_room_id
          and participants.urutan_giliran is not null), 1)
  )
   limit 1;
$$;

create or replace function public.mulai_sesi(p_kode text, p_host_token text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room public.rooms%rowtype;
begin
  select * into v_room from public.rooms
   where rooms.kode = upper(trim(p_kode)) and rooms.kedaluwarsa_pada > now();
  if not found then
    raise exception 'Room not found.';
  end if;

  if not exists (select 1 from public.room_secrets
                  where room_secrets.room_id = v_room.id
                    and room_secrets.host_token = p_host_token) then
    raise exception 'Only the host can start the session.';
  end if;

  if v_room.status <> 'lobby' then
    raise exception 'This session has already started.';
  end if;

  -- Pengacakan terjadi tepat sekali, di sini. Setelah ini urutannya tetap,
  -- supaya peserta bisa melihat kapan gilirannya datang.
  with acak as (
    select id, (row_number() over (order by random())) - 1 as urutan
      from public.participants
     where participants.room_id = v_room.id
  )
  update public.participants p
     set urutan_giliran = a.urutan
    from acak a
   where p.id = a.id;

  update public.rooms
     set status = 'berjalan', nomor_giliran_sekarang = 0
   where rooms.id = v_room.id;
end;
$$;

create or replace function public.giliran_berikutnya(p_kode text, p_host_token text)
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room public.rooms%rowtype;
  v_baru int;
begin
  select * into v_room from public.rooms
   where rooms.kode = upper(trim(p_kode)) and rooms.kedaluwarsa_pada > now();
  if not found then
    raise exception 'Room not found.';
  end if;

  if not exists (select 1 from public.room_secrets
                  where room_secrets.room_id = v_room.id
                    and room_secrets.host_token = p_host_token) then
    raise exception 'Only the host can move to the next turn.';
  end if;

  if v_room.status <> 'berjalan' then
    raise exception 'This session has not started yet.';
  end if;

  v_baru := v_room.nomor_giliran_sekarang + 1;
  update public.rooms set nomor_giliran_sekarang = v_baru
   where rooms.id = v_room.id;
  return v_baru;
end;
$$;

-- Menggantikan versi Potongan 3. Dua perubahan yang disengaja:
-- (1) kepemilikan giliran sekarang ditegakkan, (2) fungsi ini TIDAK lagi
-- menambah nomor giliran; itu jadi tugas giliran_berikutnya milik host,
-- supaya obrolan boleh melebar tanpa dikejar aplikasi.
drop function if exists public.putar_roda(text, text);

create or replace function public.putar_roda(
  p_kode text,
  p_token text,
  p_host_token text
)
returns table (
  room_question_id uuid,
  teks text,
  nomor_giliran int,
  benih_animasi int
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room public.rooms%rowtype;
  v_pemanggil uuid;
  v_pemilik uuid;
  v_adalah_host boolean := false;
  v_pertanyaan public.room_questions%rowtype;
  v_benih int;
begin
  select * into v_room from public.rooms
   where rooms.kode = upper(trim(p_kode)) and rooms.kedaluwarsa_pada > now();
  if not found then
    raise exception 'Room not found.';
  end if;

  if v_room.status <> 'berjalan' then
    raise exception 'This session has not started yet.';
  end if;

  select p.id into v_pemanggil
    from public.participants p
    join public.participant_secrets s on s.participant_id = p.id
   where p.room_id = v_room.id and s.token = p_token;
  if not found then
    raise exception 'You are not in this room.';
  end if;

  v_adalah_host := p_host_token is not null and exists (
    select 1 from public.room_secrets
     where room_secrets.room_id = v_room.id
       and room_secrets.host_token = p_host_token);

  v_pemilik := public.pemilik_giliran(v_room.id, v_room.nomor_giliran_sekarang);

  -- Penegakannya ada di sini, bukan pada tombol yang mati di browser.
  -- Tombol yang mati cuma penjelas; ini pengamannya.
  if not v_adalah_host and v_pemanggil is distinct from v_pemilik then
    raise exception 'It is not your turn yet.';
  end if;

  select * into v_pertanyaan
    from public.room_questions q
   where q.room_id = v_room.id
   order by random()
   limit 1;
  if not found then
    raise exception 'This room has no questions left.';
  end if;

  v_benih := floor(random() * 1000)::int;

  -- Batasan unik (room_id, nomor_giliran) yang menolak putaran kedua.
  -- Pesannya diganti kalimat yang bisa dibaca; yang menolak tetap batasannya.
  begin
    insert into public.spins (
      room_id, participant_id, room_question_id, nomor_giliran, benih_animasi
    ) values (
      v_room.id, coalesce(v_pemilik, v_pemanggil), v_pertanyaan.id,
      v_room.nomor_giliran_sekarang, v_benih
    );
  exception when unique_violation then
    raise exception 'This turn already has its question.';
  end;

  update public.room_questions set sudah_keluar = true
   where room_questions.id = v_pertanyaan.id;

  return query select v_pertanyaan.id, v_pertanyaan.teks,
                      v_room.nomor_giliran_sekarang, v_benih;
end;
$$;

-- Menggantikan versi Potongan 2: pendatang yang telat sekarang mendapat
-- urutan giliran di ekor, bukan dibiarkan kosong.
--
-- Semua kolom diawali nama tabelnya. Klausa returns table membuat room_id jadi
-- variabel keluaran, dan tanpa awalan itu Postgres menolak dengan keluhan
-- bahwa acuan kolomnya ambigu. Persis galat yang sudah pernah menjaring fungsi
-- ini di Potongan 2, dan cuplikan di rencana Potongan 4 mengulanginya lagi.
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
  v_urutan int;
begin
  if p_nama is null or length(trim(p_nama)) = 0
     or length(trim(p_nama)) > 20 then
    raise exception 'Name is required, 20 characters max.';
  end if;

  select * into v_room from public.rooms
   where rooms.kode = upper(trim(p_kode)) and rooms.kedaluwarsa_pada > now();
  if not found then
    raise exception 'Room not found.';
  end if;

  if v_room.status = 'selesai' then
    raise exception 'This session has already finished.';
  end if;

  if v_room.status = 'berjalan' and not v_room.opsi_izinkan_join_telat then
    raise exception 'This session has already started and is closed to new people.';
  end if;

  if exists (select 1 from public.participants
              where participants.room_id = v_room.id
                and participants.nama = trim(p_nama)) then
    raise exception 'That name is already taken in this room.';
  end if;

  -- Ekor antrean, bukan sisipan acak. Penyisipan acak bisa memberi giliran
  -- kedua ke orang yang sudah lewat sementara ada yang belum sama sekali.
  if v_room.status = 'berjalan' then
    select coalesce(max(participants.urutan_giliran), -1) + 1 into v_urutan
      from public.participants where participants.room_id = v_room.id;
  else
    v_urutan := null;
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');

  insert into public.participants (room_id, nama, urutan_giliran)
    values (v_room.id, trim(p_nama), v_urutan)
    returning id into v_participant_id;
  insert into public.participant_secrets (participant_id, token)
    values (v_participant_id, v_token);

  return query select v_room.id, v_participant_id, v_token;
end;
$$;

grant execute on function public.mulai_sesi(text, text) to anon;
grant execute on function public.giliran_berikutnya(text, text) to anon;
grant execute on function public.putar_roda(text, text, text) to anon;
grant execute on function public.masuk_room(text, text) to anon;

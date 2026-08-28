create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique,
  status text not null default 'lobby'
    check (status in ('lobby', 'berjalan', 'selesai')),
  nomor_giliran_sekarang int not null default 0,
  opsi_buang_terpakai boolean not null default true,
  opsi_izinkan_join_telat boolean not null default true,
  dibuat_pada timestamptz not null default now(),
  kedaluwarsa_pada timestamptz not null default now() + interval '12 hours'
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  nama text not null,
  urutan_giliran int,
  adalah_host boolean not null default false,
  bergabung_pada timestamptz not null default now(),
  unique (room_id, nama)
);

create index if not exists participants_room_idx
  on public.participants(room_id);

-- Rahasia dipisah ke tabelnya sendiri. Dua tabel di bawah ini sengaja
-- TIDAK punya satu pun kebijakan RLS, sehingga anon tidak bisa membaca
-- apa-apa dari sini. Fungsi security definer tetap bisa, karena ia
-- melewati RLS.
create table if not exists public.room_secrets (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  host_token text not null
);

create table if not exists public.participant_secrets (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  token text not null
);

alter table public.rooms enable row level security;
alter table public.participants enable row level security;
alter table public.room_secrets enable row level security;
alter table public.participant_secrets enable row level security;

drop policy if exists "rooms boleh dibaca" on public.rooms;
create policy "rooms boleh dibaca" on public.rooms for select using (true);

drop policy if exists "participants boleh dibaca" on public.participants;
create policy "participants boleh dibaca" on public.participants for select using (true);

-- Pembangkit kode 5 karakter tanpa O, 0, I, 1, L supaya tidak salah
-- dengar saat disebut lisan.
create or replace function public.buat_kode_room()
returns text
language plpgsql
as $$
declare
  huruf text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  hasil text;
  i int;
begin
  loop
    hasil := '';
    for i in 1..5 loop
      hasil := hasil || substr(huruf, 1 + floor(random() * length(huruf))::int, 1);
    end loop;
    exit when not exists (select 1 from public.rooms where kode = hasil);
  end loop;
  return hasil;
end;
$$;

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
    raise exception 'nama tidak sah';
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
    raise exception 'nama tidak sah';
  end if;

  select * into v_room from public.rooms
   where kode = upper(trim(p_kode)) and kedaluwarsa_pada > now();

  if not found then
    raise exception 'room tidak ditemukan';
  end if;

  if v_room.status = 'selesai' then
    raise exception 'sesi sudah selesai';
  end if;

  if v_room.status = 'berjalan' and not v_room.opsi_izinkan_join_telat then
    raise exception 'sesi sudah dimulai dan ditutup untuk peserta baru';
  end if;

  -- Kolomnya wajib diawali nama tabel. 'returns table (room_id ...)' membuat
  -- room_id jadi variabel keluaran, dan tanpa awalan ini Postgres menolak
  -- dengan 'column reference "room_id" is ambiguous'.
  if exists (select 1 from public.participants
              where participants.room_id = v_room.id
                and participants.nama = trim(p_nama)) then
    raise exception 'nama sudah dipakai di room ini';
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

grant execute on function public.buat_room(text) to anon;
grant execute on function public.masuk_room(text, text) to anon;

-- Idempoten: 'alter publication ... add table' melempar galat kalau tabelnya
-- sudah terdaftar, dan galat itu menggagalkan sisa eksekusi. Dibungkus
-- pemeriksaan supaya berkas ini aman dijalankan ulang berapa kali pun.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'participants'
  ) then
    alter publication supabase_realtime add table public.participants;
  end if;
end $$;

-- Realtime menuntut lebih dari sekadar tabel terdaftar di publikasi. Saat
-- pertama kali dijalankan, langganan postgres_changes berstatus SUBSCRIBED
-- tapi tidak satu pun peristiwa sampai, sementara broadcast pada project yang
-- sama sampai dengan selamat — jadi transport dan otentikasinya sehat.
-- Menjalankan ulang blok publikasi di atas berikut dua baris di bawah ini
-- membuatnya bekerja; peristiwa INSERT sampai dalam 592 ms.
--
-- Mana dari keduanya yang menjadi obatnya tidak terukur, karena keadaan
-- publikasi sebelum perbaikan tidak sempat direkam. Secara teori
-- 'replica identity' tidak berpengaruh untuk INSERT, sehingga dugaan
-- terkuatnya adalah publikasinya yang belum terisi. Keduanya tetap ditulis
-- di sini supaya keadaan yang terbukti jalan bisa direproduksi utuh, dan
-- 'full' memang tetap dibutuhkan nanti untuk menyaring UPDATE dan DELETE.
alter table public.rooms replica identity full;
alter table public.participants replica identity full;

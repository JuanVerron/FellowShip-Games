-- Kolam pertanyaan per room dan riwayat putaran.
--
-- Teks pertanyaan DISALIN ke room_questions, bukan dirujuk lewat id bank.
-- Bank berubah lewat deploy; room yang cuma menyimpan id bisa berubah teks
-- atau kehilangan pertanyaan di tengah sesi.

create table if not exists public.room_questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  sumber text not null default 'custom' check (sumber in ('bank', 'custom')),
  bank_question_id text,
  teks text not null,
  urutan int not null,
  sudah_keluar boolean not null default false,
  unique (room_id, urutan)
);

create index if not exists room_questions_room_idx
  on public.room_questions(room_id);

create table if not exists public.spins (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  room_question_id uuid not null references public.room_questions(id) on delete cascade,
  nomor_giliran int not null,
  benih_animasi int not null,
  dibuat_pada timestamptz not null default now(),
  unique (room_id, nomor_giliran)
);

create index if not exists spins_room_idx on public.spins(room_id);

alter table public.room_questions enable row level security;
alter table public.spins enable row level security;

drop policy if exists "room_questions boleh dibaca" on public.room_questions;
create policy "room_questions boleh dibaca"
  on public.room_questions for select using (true);

drop policy if exists "spins boleh dibaca" on public.spins;
create policy "spins boleh dibaca" on public.spins for select using (true);

-- Menggantikan versi satu argumen dari Potongan 2. Penggantian ini disengaja:
-- kolam pertanyaan harus terisi pada saat room dibuat, supaya room tidak
-- pernah ada dalam keadaan tanpa isi.
drop function if exists public.buat_room(text);

create or replace function public.buat_room(
  p_nama_host text,
  p_pertanyaan text[]
)
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
  v_teks text;
  v_urutan int := 0;
begin
  if p_nama_host is null or length(trim(p_nama_host)) = 0
     or length(trim(p_nama_host)) > 20 then
    raise exception 'Name is required, 20 characters max.';
  end if;

  if p_pertanyaan is null or array_length(p_pertanyaan, 1) is null then
    raise exception 'A room needs at least one question.';
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

  foreach v_teks in array p_pertanyaan loop
    if v_teks is not null and length(trim(v_teks)) > 0 then
      insert into public.room_questions (room_id, teks, urutan)
        values (v_room_id, trim(v_teks), v_urutan);
      v_urutan := v_urutan + 1;
    end if;
  end loop;

  if v_urutan = 0 then
    raise exception 'A room needs at least one question.';
  end if;

  return query select v_room_id, v_kode, v_host_token,
                      v_participant_id, v_participant_token;
end;
$$;

create or replace function public.putar_roda(p_kode text, p_token text)
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
  v_participant_id uuid;
  v_pertanyaan public.room_questions%rowtype;
  v_benih int;
begin
  select * into v_room from public.rooms
   where rooms.kode = upper(trim(p_kode)) and rooms.kedaluwarsa_pada > now();
  if not found then
    raise exception 'Room not found.';
  end if;

  select p.id into v_participant_id
    from public.participants p
    join public.participant_secrets s on s.participant_id = p.id
   where p.room_id = v_room.id and s.token = p_token;
  if not found then
    raise exception 'You are not in this room.';
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

  -- Baris di bawah ini adalah kuncinya. Batasan unik (room_id, nomor_giliran)
  -- membuat penekanan kedua yang tiba nyaris bersamaan gagal di sini, bukan
  -- menghasilkan pertanyaan kedua. Penjagaan di kode aplikasi selalu bisa
  -- kalah oleh dua permintaan yang datang nyaris bersamaan.
  begin
    insert into public.spins (
      room_id, participant_id, room_question_id, nomor_giliran, benih_animasi
    ) values (
      v_room.id, v_participant_id, v_pertanyaan.id,
      v_room.nomor_giliran_sekarang, v_benih
    );
  exception when unique_violation then
    -- Pesan ini ikut tampil di layar, jadi ia bagian antarmuka.
    raise exception 'Someone else just spun. Here comes their question.';
  end;

  update public.room_questions set sudah_keluar = true
   where room_questions.id = v_pertanyaan.id;

  -- Sementara: di Potongan 4 penambahan nomor giliran pindah ke fungsi
  -- giliran_berikutnya milik host, dan baris ini dihapus.
  update public.rooms
     set nomor_giliran_sekarang = rooms.nomor_giliran_sekarang + 1
   where rooms.id = v_room.id;

  return query select v_pertanyaan.id, v_pertanyaan.teks,
                      v_room.nomor_giliran_sekarang, v_benih;
end;
$$;

grant execute on function public.buat_room(text, text[]) to anon;
grant execute on function public.putar_roda(text, text) to anon;

-- Idempoten, sama alasannya seperti di 0002: 'alter publication ... add table'
-- melempar galat kalau tabelnya sudah terdaftar, dan galat itu menggagalkan
-- sisa eksekusi.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'room_questions'
  ) then
    alter publication supabase_realtime add table public.room_questions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'spins'
  ) then
    alter publication supabase_realtime add table public.spins;
  end if;
end $$;

-- Pelajaran dari 0002: keadaan yang terbukti mengirim peristiwa Realtime
-- adalah publikasi terisi berikut replica identity full. Ditulis ulang di sini
-- supaya tabel baru berangkat dari keadaan yang sama.
alter table public.room_questions replica identity full;
alter table public.spins replica identity full;

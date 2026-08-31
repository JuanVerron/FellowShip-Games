-- Opsi room lengkap dan kolam yang menyusut.
--
-- Dua perubahan sekaligus karena keduanya menyentuh fungsi yang sama:
--   1. `buat_room` menerima kedua sakelar opsi, dan daftar pertanyaannya
--      membawa asal-usul tiap butir (bank atau tulis sendiri), bukan cuma teks.
--   2. `putar_roda` menghormati `opsi_buang_terpakai` dan menutup sesi saat
--      kolam habis.
--
-- Daftar pertanyaan pindah dari `text[]` ke `jsonb` karena `room_questions`
-- punya kolom `sumber` dan `bank_question_id` sejak Potongan 4, dan larik teks
-- polos tidak punya tempat untuk membawanya.

drop function if exists public.buat_room(text, text[]);

create or replace function public.buat_room(
  p_nama_host text,
  p_pertanyaan jsonb,
  p_buang_terpakai boolean,
  p_izinkan_join_telat boolean
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
-- `extensions` wajib ikut: gen_random_bytes tinggal di sana, bukan di public.
set search_path = public, extensions
as $$
declare
  v_room_id uuid;
  v_kode text;
  v_host_token text;
  v_participant_id uuid;
  v_participant_token text;
  v_butir jsonb;
  v_teks text;
  v_urutan int := 0;
begin
  if p_nama_host is null or length(trim(p_nama_host)) = 0
     or length(trim(p_nama_host)) > 20 then
    raise exception 'Name is required, 20 characters max.';
  end if;

  if p_pertanyaan is null or jsonb_array_length(p_pertanyaan) = 0 then
    raise exception 'A room needs at least one question.';
  end if;

  v_kode := public.buat_kode_room();
  v_host_token := encode(gen_random_bytes(24), 'hex');
  v_participant_token := encode(gen_random_bytes(24), 'hex');

  insert into public.rooms (kode, opsi_buang_terpakai, opsi_izinkan_join_telat)
    values (v_kode, coalesce(p_buang_terpakai, true),
            coalesce(p_izinkan_join_telat, true))
    returning id into v_room_id;

  insert into public.room_secrets (room_id, host_token)
    values (v_room_id, v_host_token);

  insert into public.participants (room_id, nama, adalah_host)
    values (v_room_id, trim(p_nama_host), true)
    returning id into v_participant_id;

  insert into public.participant_secrets (participant_id, token)
    values (v_participant_id, v_participant_token);

  for v_butir in select * from jsonb_array_elements(p_pertanyaan) loop
    v_teks := trim(v_butir ->> 'teks');
    if v_teks is not null and length(v_teks) > 0 then
      insert into public.room_questions
        (room_id, sumber, bank_question_id, teks, urutan)
        values (
          v_room_id,
          coalesce(v_butir ->> 'sumber', 'custom'),
          v_butir ->> 'bankId',
          v_teks,
          v_urutan
        );
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

-- Menggantikan versi Potongan 4: kolam sekarang menyusut kalau host memilih
-- opsi buang-terpakai, dan sesi berpindah ke `selesai` begitu kolam habis.
--
-- Semua acuan kolom diawali nama tabelnya. Klausa `returns table` membuat
-- `teks` jadi variabel keluaran, dan tanpa awalan itu Postgres menolak dengan
-- keluhan bahwa acuannya ambigu — galat yang sudah pernah menjaring fungsi ini
-- di Potongan 4.
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

  -- Inti opsi buang-terpakai. Kalau opsinya mati, pertanyaan yang sudah keluar
  -- tetap ikut undian dan kolam tidak pernah habis.
  select * into v_pertanyaan
    from public.room_questions q
   where q.room_id = v_room.id
     and (not v_room.opsi_buang_terpakai or not q.sudah_keluar)
   order by random()
   limit 1;

  if not found then
    -- Kolam habis. Sesi ditutup dan fungsi mengembalikan NOL BARIS.
    --
    -- Sengaja BUKAN `raise exception` di sini. Exception membatalkan seluruh
    -- transaksi, termasuk update status tepat di bawah ini, sehingga sesi tidak
    -- akan pernah benar-benar tertutup dan setiap putaran berikutnya mengulang
    -- galat yang sama. Klien membaca nol baris sebagai "kolam habis", dan
    -- Realtime mendorong perubahan status ke semua layar.
    update public.rooms set status = 'selesai' where rooms.id = v_room.id;
    return;
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

grant execute on function public.buat_room(text, jsonb, boolean, boolean) to anon;
grant execute on function public.putar_roda(text, text, text) to anon;

-- Sisipan pertanyaan milik host, di tengah sesi yang sedang berjalan.
--
-- Semua acuan kolom diawali nama tabelnya, mengikuti pola migrasi Potongan 4
-- dan 5. `extensions` ikut di search_path supaya sejalan dengan fungsi lain,
-- walau fungsi ini sendiri belum memanggil apa pun dari sana.
create or replace function public.sisip_pertanyaan(
  p_kode text,
  p_host_token text,
  p_teks text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room public.rooms%rowtype;
  v_urutan int;
  v_id uuid;
begin
  select * into v_room from public.rooms
   where rooms.kode = upper(trim(p_kode)) and rooms.kedaluwarsa_pada > now();
  if not found then
    raise exception 'Room not found.';
  end if;

  -- Kewenangan host dibuktikan dengan host_token, bukan dengan kotak sisipan
  -- yang cuma disembunyikan di browser.
  if not exists (select 1 from public.room_secrets
                  where room_secrets.room_id = v_room.id
                    and room_secrets.host_token = p_host_token) then
    raise exception 'Only the host can add a question.';
  end if;

  if v_room.status = 'selesai' then
    raise exception 'This session has already finished.';
  end if;

  if p_teks is null or length(trim(p_teks)) = 0 then
    raise exception 'A question needs some text.';
  end if;

  if length(trim(p_teks)) > 200 then
    raise exception 'That question is too long, 200 characters max.';
  end if;

  select coalesce(max(q.urutan), -1) + 1 into v_urutan
    from public.room_questions q where q.room_id = v_room.id;

  -- Masuk kolam dengan sudah_keluar = false, sehingga ia ikut undian
  -- putaran BERIKUTNYA. Tidak ada jalan bagi host untuk memaksanya keluar
  -- sekarang juga; itu disengaja, supaya roda tidak bisa diarahkan.
  insert into public.room_questions (room_id, sumber, teks, urutan)
    values (v_room.id, 'custom', trim(p_teks), v_urutan)
    returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.sisip_pertanyaan(text, text, text) to anon;

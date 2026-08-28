create table if not exists public.app_health (
  id smallint primary key default 1,
  disentuh_pada timestamptz not null default now(),
  constraint app_health_baris_tunggal check (id = 1)
);

insert into public.app_health (id) values (1)
  on conflict (id) do nothing;

alter table public.app_health enable row level security;

drop policy if exists "app_health boleh dibaca siapa saja" on public.app_health;
create policy "app_health boleh dibaca siapa saja"
  on public.app_health
  for select
  using (true);

create or replace function public.sentuh_kesehatan()
returns timestamptz
language sql
security definer
set search_path = public
as $$
  update public.app_health
     set disentuh_pada = now()
   where id = 1
  returning disentuh_pada;
$$;

grant execute on function public.sentuh_kesehatan() to anon;

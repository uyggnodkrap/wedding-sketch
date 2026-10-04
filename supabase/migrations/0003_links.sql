-- 카드 사이 연결선. 방향(from → to)을 저장하고 모양은 실선(기본) 또는 화살표
create table public.links (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.cards(id) on delete cascade,
  to_id uuid not null references public.cards(id) on delete cascade,
  style text not null default 'line' check (style in ('line', 'arrow')),
  created_at timestamptz not null default now(),
  unique (from_id, to_id),
  check (from_id <> to_id)
);

alter table public.links enable row level security;

create policy "signed-in users" on public.links
  for all to authenticated
  using (true)
  with check (true);

alter publication supabase_realtime add table public.links;

create table public.allowed_emails (
  email text primary key
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  text text not null default '',
  url text,
  done boolean not null default false,
  x real not null,
  y real not null,
  sort_order double precision not null,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.allowed_emails enable row level security;
alter table public.cards enable row level security;

-- 자기 이메일 행만 보인다 (로그인 직후 접근 권한 확인용)
create policy "own email" on public.allowed_emails
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- 허용 목록에 있는 사용자만 카드 전체 읽기/쓰기
create policy "allowed users" on public.cards
  for all to authenticated
  using (exists (select 1 from public.allowed_emails where lower(email) = lower(auth.jwt() ->> 'email')))
  with check (exists (select 1 from public.allowed_emails where lower(email) = lower(auth.jwt() ->> 'email')));

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger cards_touch_updated_at
  before update on public.cards
  for each row execute function public.touch_updated_at();

alter publication supabase_realtime add table public.cards;

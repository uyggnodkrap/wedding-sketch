-- 승인 = 관리자가 대시보드에서 계정을 만든 것. 신규 가입은 Auth 설정에서 막혀 있어야 한다.
drop policy "allowed users" on public.cards;

create policy "signed-in users" on public.cards
  for all to authenticated
  using (true)
  with check (true);

drop table public.allowed_emails;

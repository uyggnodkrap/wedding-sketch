-- 최소 1명이 로그인해 auth.users에 행이 있어야 실행 가능. 트랜잭션은 롤백되어 흔적이 남지 않는다.
begin;

insert into public.cards (x, y, sort_order, author_id)
select 0, 0, 0, id from auth.users limit 1;

set local role authenticated;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated","email":"stranger@example.com"}', true);
select count(*) as stranger_sees from public.cards;   -- 기대값: 0

select set_config('request.jwt.claims',
  json_build_object('sub', gen_random_uuid(), 'role', 'authenticated',
    'email', (select email from public.allowed_emails limit 1))::text, true);
select count(*) as allowed_sees from public.cards;    -- 기대값: 1 이상

rollback;

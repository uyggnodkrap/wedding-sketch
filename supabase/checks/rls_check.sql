-- 최소 1명의 계정이 있어야 실행 가능. 트랜잭션은 롤백되어 흔적이 남지 않는다.
begin;

insert into public.cards (x, y, sort_order, author_id)
select 0, 0, 0, id from auth.users limit 1;

set local role anon;
select count(*) as anon_sees from public.cards;       -- 기대값: 0

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users limit 1), 'role', 'authenticated')::text, true);
select count(*) as signed_in_sees from public.cards;  -- 기대값: 1 이상

rollback;

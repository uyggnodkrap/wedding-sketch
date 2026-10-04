-- 카드 동그라미 색 (src/cards/palette.ts의 key). null이면 작성자 색으로 표시
alter table public.cards add column color text;

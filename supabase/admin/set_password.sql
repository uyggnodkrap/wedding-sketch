-- 관리자용: 계정 비밀번호 설정/변경. SQL Editor에서 이메일과 비밀번호를 바꿔 실행한다.
-- 실행 후 이 SQL은 저장하지 말 것 (비밀번호가 쿼리 기록에 남음).
update auth.users
set encrypted_password = extensions.crypt('여기에-새-비밀번호', extensions.gen_salt('bf')),
    updated_at = now()
where email = 'user@example.com'
returning email;

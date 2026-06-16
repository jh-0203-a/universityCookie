-- 본인 확인용 실명/생년월일 — 휴대폰 본인인증(PASS류)으로 확인되는 정보입니다.
-- 지역 인증(주민등록증) 심사 때 관리자가 이 값과 서류를 대조해 실효성을 높입니다.
ALTER TABLE users ADD COLUMN IF NOT EXISTS real_name VARCHAR(40); -- 실명
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth     VARCHAR(20); -- 생년월일 (예: '1999-03-15')

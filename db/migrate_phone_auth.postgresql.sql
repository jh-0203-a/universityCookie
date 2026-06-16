-- ============================================================
-- 청년와글 마이그레이션: 회원가입 휴대폰 본인인증
--  - users 에 휴대폰 번호 + 인증 여부 컬럼 추가
--  - 휴대폰 번호는 "1인 1계정"을 위해 중복 불가(UNIQUE). 단 기존 회원(번호 없음)은 NULL 허용.
--  - 여러 번 실행해도 안전합니다.
--  - 실행:  node 로 적용하거나  psql -U postgres -d cookie_db -f db/migrate_phone_auth.postgresql.sql
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone          VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- 번호가 있는 회원끼리는 중복 금지 (NULL 은 여러 개 허용)
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON users(phone) WHERE phone IS NOT NULL;

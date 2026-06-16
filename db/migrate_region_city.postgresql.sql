-- ============================================================
-- 지역 배지 상세화 마이그레이션
--  - 지역 인증 시 "경기도 수원시"까지 받아 배지에 '수원'처럼 표시하기 위함.
--  - 대학교명/지역명을 배지에 표시할지 끄는 설정도 함께 추가.
--  - 여러 번 실행해도 안전합니다 (IF NOT EXISTS).
--  - 실행:  psql -U postgres -d cookie_db -f db/migrate_region_city.postgresql.sql
-- ============================================================

-- 회원: 정확한 지역(시/도 시군구) + 배지 표시 숨김 설정
ALTER TABLE users ADD COLUMN IF NOT EXISTS region_city      VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS hide_school_name BOOLEAN NOT NULL DEFAULT FALSE;  -- 대학교명 숨기기
ALTER TABLE users ADD COLUMN IF NOT EXISTS hide_region_name BOOLEAN NOT NULL DEFAULT FALSE;  -- 지역명 숨기기

-- 인증 요청: 회원이 제출한 정확한 지역(승인 시 users.region_city 로 복사)
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS region_city VARCHAR(50);

-- ============================================================
-- 청년와글 마이그레이션: 인증 배지(대학🎓/지역📍) + 수원대/수원여대 테스트 계정
--  - 기존 DB를 "비우지 않고" 안전하게 컬럼만 추가하고 데이터를 넣습니다.
--  - 여러 번 실행해도 안전합니다 (IF NOT EXISTS / ON CONFLICT).
--  - 실행:  psql -U postgres -d cookie_db -f db/migrate_youth_badges.postgresql.sql
-- ============================================================

-- 1) users 표에 인증 관련 컬럼 추가 (이미 있으면 건너뜀)
ALTER TABLE users ADD COLUMN IF NOT EXISTS school_method   VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS region_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cert_url        VARCHAR(500);

-- 2) verifications 표에 인증 종류/수단 컬럼 추가
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS type   VARCHAR(10) NOT NULL DEFAULT '대학';
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS method VARCHAR(50);
-- 종류 값 제약(대학/지역)도 없으면 추가
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'verifications_type_check') THEN
    ALTER TABLE verifications ADD CONSTRAINT verifications_type_check CHECK (type IN ('대학','지역'));
  END IF;
END $$;

-- 3) 기존 데모 회원들 인증 상태 갱신 (배지 차별화 시연용)
UPDATE users SET verified = TRUE, school_method = '졸업증명서',          region_verified = TRUE  WHERE email = 'sungA@skku.ac.kr';
UPDATE users SET verified = TRUE, school_method = '학생증(졸업생 표시)'                          WHERE email = 'sungB@skku.ac.kr';
UPDATE users SET verified = TRUE, school_method = '대학교 이메일',        region_verified = TRUE  WHERE email = 'ajouA@ajou.ac.kr';
UPDATE users SET verified = TRUE, school_method = '졸업증명서'                                    WHERE email = 'ajouB@ajou.ac.kr';
UPDATE users SET verified = TRUE                                                                  WHERE email = 'anyang@anyang.ac.kr';
UPDATE users SET verified = TRUE                                                                  WHERE email = 'admin@cookie.com';

-- 4) 수원대 / 수원여대 재학생 테스트 계정 추가 (이미 있으면 무시)
--    대학교 이메일 인증 → 🎓 학교이메일,  재학증명서 인증 → 🎓 증명서
INSERT INTO users (nickname, email, password_hash, school, grad_year, region, role, status, verified, school_method, region_verified) VALUES
  ('수원대생',   'student@suwon.ac.kr', 'TEST_HASH', '수원대학교',     NULL, '남서부권', '회원', '정상', TRUE, '대학교 이메일', FALSE),
  ('수원여대생', 'student@swc.ac.kr',   'TEST_HASH', '수원여자대학교', NULL, '남서부권', '회원', '정상', TRUE, '재학증명서',    FALSE)
ON CONFLICT (email) DO NOTHING;

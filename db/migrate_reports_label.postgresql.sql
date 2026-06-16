-- ============================================================
-- 신고(reports) 마이그레이션: 신고 대상 내용(target_label) 컬럼 추가
--  - 화면에서는 신고 대상의 제목/댓글 내용 등을 함께 보여줘야 해서 컬럼을 추가합니다.
--  - 여러 번 실행해도 안전합니다 (IF NOT EXISTS).
--  - 실행:  psql -U postgres -d cookie_db -f db/migrate_reports_label.postgresql.sql
-- ============================================================

ALTER TABLE reports ADD COLUMN IF NOT EXISTS target_label VARCHAR(255);

-- 인증(verifications) 거절 사유도 DB에 보관 (관리자가 거절 시 적는 사유)
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS reject_reason VARCHAR(255);

-- 알림(notifications): 예전 버전은 link 한 컬럼만 있어, 화면에서 쓰는
--  - post_id(누르면 이동할 글) / note_with(누르면 이동할 쪽지 상대) 컬럼을 추가합니다.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS post_id   BIGINT REFERENCES posts(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS note_with VARCHAR(50);
-- 더 이상 쓰지 않는 link 는 값이 없어도 되도록 NULL 허용으로 바꿉니다.
--  ※ 새로 만든 스키마에는 link 컬럼이 아예 없으므로, 컬럼이 있을 때만 실행합니다.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'link'
  ) THEN
    ALTER TABLE notifications ALTER COLUMN link DROP NOT NULL;
  END IF;
END $$;

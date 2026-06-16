-- ============================================================
-- 모임 게시글 투표(폴) 마이그레이션
--  - 모임 게시글에 선택지를 달아 멤버들이 투표할 수 있게 합니다. (1인 1표, 변경 가능)
--  - 여러 번 실행해도 안전합니다 (IF NOT EXISTS).
--  - 실행:  psql -U postgres -d cookie_db -f db/migrate_meetup_poll.postgresql.sql
-- ============================================================

-- 투표 선택지 (한 게시글에 여러 개)
CREATE TABLE IF NOT EXISTS meetup_poll_options (
  id              BIGSERIAL PRIMARY KEY,
  meetup_post_id  BIGINT NOT NULL REFERENCES meetup_posts(id) ON DELETE CASCADE,
  label           VARCHAR(200) NOT NULL,
  sort            INT NOT NULL DEFAULT 0
);

-- 누가 어느 선택지에 투표했는지 (한 게시글당 1인 1표 → 기본키로 보장)
CREATE TABLE IF NOT EXISTS meetup_poll_votes (
  meetup_post_id  BIGINT NOT NULL REFERENCES meetup_posts(id)         ON DELETE CASCADE,
  option_id       BIGINT NOT NULL REFERENCES meetup_poll_options(id)  ON DELETE CASCADE,
  user_id         BIGINT NOT NULL REFERENCES users(id)                ON DELETE CASCADE,
  PRIMARY KEY (meetup_post_id, user_id)
);

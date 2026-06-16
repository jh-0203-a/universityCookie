-- 대댓글(답글) 기능: 댓글이 다른 댓글의 자식이 될 수 있게 parent_id 추가
-- parent_id 가 NULL 이면 최상위 댓글, 값이 있으면 그 댓글에 달린 답글입니다.

-- 커뮤니티 게시글 댓글
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES comments(id) ON DELETE CASCADE;

-- 중고거래 판매글 댓글
ALTER TABLE item_comments ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES item_comments(id) ON DELETE CASCADE;

-- 모임 게시글 댓글 (지금까지 없었으므로 새로 만듭니다. parent_id 로 답글까지 지원)
CREATE TABLE IF NOT EXISTS meetup_post_comments (
  id              BIGSERIAL PRIMARY KEY,
  meetup_post_id  BIGINT NOT NULL REFERENCES meetup_posts(id) ON DELETE CASCADE,
  author_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id       BIGINT REFERENCES meetup_post_comments(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 중고거래(판매글) 댓글 테이블
-- 게시글 댓글(comments)과 같은 구조이며, 상품(market_items)에 달립니다.
CREATE TABLE IF NOT EXISTS item_comments (
  id          BIGSERIAL PRIMARY KEY,
  item_id     BIGINT NOT NULL REFERENCES market_items(id) ON DELETE CASCADE,
  author_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

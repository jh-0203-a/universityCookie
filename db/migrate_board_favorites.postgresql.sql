-- 개인 게시판 고정(즐겨찾기): 회원이 특정 게시판을 자기 화면에 계속 고정해 둘 수 있게
-- 기본 게시판(자유/익명/학교별/취업)은 boards 테이블에 없으므로 '이름'으로 보관합니다.
CREATE TABLE IF NOT EXISTS board_favorites (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  board_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, board_name)
);

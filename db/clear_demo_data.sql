-- ============================================================
-- 데모/샘플 콘텐츠 비우기 ("pure" 시작)
--  - 게시판(posts)·모임(meetups)·중고거래(market_items)·채팅(chat_rooms) 및
--    그에 딸린 댓글/사진/좋아요/메시지/멤버 등을 모두 삭제합니다. (CASCADE)
--  - 알림·신고·문의·쪽지·인증요청·고정게시판·사용자생성게시판도 함께 비웁니다.
--  - 회원 계정(users)과 테이블 구조는 그대로 둡니다.
--  - RESTART IDENTITY: 글 번호 등 id를 1부터 다시 시작.
-- ============================================================

TRUNCATE
  posts,
  meetups,
  market_items,
  chat_rooms,
  boards,
  notifications,
  reports,
  inquiries,
  notes,
  verifications,
  board_favorites
RESTART IDENTITY CASCADE;

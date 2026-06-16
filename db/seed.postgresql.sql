-- ============================================================
-- 청년와글 - 예시(샘플) 데이터  (PostgreSQL)
--  - schema.postgresql.sql 로 표를 먼저 만든 뒤 실행하세요.
--  - 맨 위 TRUNCATE 로 기존 데이터를 비우므로, 여러 번 실행해도 안전합니다.
--    (RESTART IDENTITY = 자동 번호도 1부터 다시, CASCADE = 연결된 표까지 함께 비움)
-- ============================================================

TRUNCATE
  users, posts, post_images, comments, post_likes, boards,
  meetups, meetup_members, meetup_posts, meetup_post_images, meetup_messages, meetup_greetings,
  market_items, item_images, chat_rooms, chat_room_members, chat_messages,
  notes, inquiries, inquiry_images, reports, notifications
  RESTART IDENTITY CASCADE;

-- ----- 회원 -----
-- ※ password_hash 의 'TEST_HASH' 는 진짜 비밀번호/해시가 아니라 자리 채우기용 글자입니다.
--   (지금 앱 로그인은 비밀번호를 확인하지 않아요. 이메일만 맞으면 아무 비번이나 통과)
--   실제 서비스에선 회원가입 때 입력한 비번을 bcrypt 등으로 "해시"해서 넣게 됩니다.
--   해시는 한 방향이라, 저장된 값에서 원래 비밀번호를 알아낼 수는 없습니다.
-- verified=대학 인증🎓, school_method=인증 수단(배지 차별화), region_verified=지역 인증📍
INSERT INTO users (id, nickname, email, password_hash, school, grad_year, region, role, status, verified, school_method, region_verified, suspend_reason, suspend_period, suspend_until) VALUES
  (1, '운영자',    'admin@cookie.com',    'TEST_HASH', '청년와글 운영팀', NULL,   '관리',     '관리자','정상', TRUE,  NULL,                  FALSE, NULL, NULL, NULL),
  (2, '성대졸업A',  'sungA@skku.ac.kr',    'TEST_HASH', '성균관대',        '2022', '수원권',   '회원',  '정상', TRUE,  '졸업증명서',          TRUE,  NULL, NULL, NULL),
  (3, '성대졸업B',  'sungB@skku.ac.kr',    'TEST_HASH', '성균관대',        '2020', '수원권',   '회원',  '정상', TRUE,  '학생증(졸업생 표시)', FALSE, NULL, NULL, NULL),
  (4, '아주졸업A',  'ajouA@ajou.ac.kr',    'TEST_HASH', '아주대',          '2021', '수원권',   '회원',  '정상', TRUE,  '대학교 이메일',       TRUE,  NULL, NULL, NULL),
  (5, '아주졸업B',  'ajouB@ajou.ac.kr',    'TEST_HASH', '아주대',          '2019', '수원권',   '회원',  '정상', TRUE,  '졸업증명서',          FALSE, NULL, NULL, NULL),
  (6, '안양졸업',   'anyang@anyang.ac.kr', 'TEST_HASH', '안양대',          '2023', '안양권',   '회원',  '정상', TRUE,  NULL,                  FALSE, NULL, NULL, NULL),
  -- 경기 남서부권 · 수원대 / 수원여대 재학생 테스트 계정 (대학교 이메일 vs 증명서 배지 차이 시연)
  (7, '수원대생',   'student@suwon.ac.kr', 'TEST_HASH', '수원대학교',      NULL,   '남서부권', '회원',  '정상', TRUE,  '대학교 이메일',       FALSE, NULL, NULL, NULL),
  (8, '수원여대생', 'student@swc.ac.kr',   'TEST_HASH', '수원여자대학교',  NULL,   '남서부권', '회원',  '정상', TRUE,  '재학증명서',          FALSE, NULL, NULL, NULL);

-- ----- 게시글 -----
INSERT INTO posts (id, author_id, board_type, title, body, anonymous, school, region) VALUES
  (1, 2, '학교별', '시험기간 같이 공부할 사람!', '중앙도서관에서 매일 오후 2시에 모여요 ☕', FALSE, '성균관대', '수원권'),
  (2, 4, '자유',   '자취방 룸메이트 구해요',     '인계동 근처, 보증금 반반 부담 가능하신 분~', TRUE,  '아주대',   '수원권'),
  (3, 4, '익명',   '학식 추천 좀요 🍚',          '오늘 점심 뭐 먹지... 추천받습니다',          TRUE,  '아주대',   '수원권');

-- 게시글 사진 (실제 파일은 D:\Cookie_db\board\ 에 두고, 여기엔 경로만)
INSERT INTO post_images (post_id, url, sort) VALUES
  (1, 'board/sample_study.jpg', 0);

-- ----- 댓글 -----
INSERT INTO comments (post_id, author_id, body) VALUES
  (1, 4, '저요! 내일부터 갈게요');

-- ----- 좋아요 (1인 1회) -----
INSERT INTO post_likes (post_id, user_id) VALUES
  (1, 4);

-- ----- 모임 -----
INSERT INTO meetups (id, title, meet_when, place, capacity, created_by) VALUES
  (1, '한강 러닝 모임',      '6/15 (일) 오전 9시', '광교호수공원',     10, 4),
  (2, '코딩 스터디 (React)', '6/16 (월) 오후 7시', '온라인 (디스코드)', 8, 2);

-- 모임 참여 인원
INSERT INTO meetup_members (meetup_id, user_id) VALUES
  (2, 2),
  (2, 3);

-- 모임 게시판(공지) / 가입인사 / 채팅
INSERT INTO meetup_posts (meetup_id, author_id, title, body, notice) VALUES
  (2, 2, '첫 모임 안내', '6/16 저녁 7시에 디스코드로 모여요. 노트북 꼭 챙기기!', TRUE);
INSERT INTO meetup_greetings (meetup_id, author_id, body) VALUES
  (2, 3, '안녕하세요! React 배우러 왔어요 잘 부탁드려요 :)');
INSERT INTO meetup_messages (meetup_id, sender_id, body) VALUES
  (2, 2, '다들 환영합니다! 🎉');

-- ----- 중고거래 -----
INSERT INTO market_items (id, seller_id, title, price, place, status, body) VALUES
  (1, 2, '전공 교재 (경제학원론) 팝니다', 12000,  '성균관대', '판매중', '작년에 산 책이고 필기 거의 없어요.'),
  (2, 4, '아이패드 9세대 64GB',          290000, '아주대',   '예약중', '액정 깨끗하고 충전기 같이 드려요.');
INSERT INTO item_images (item_id, url, sort) VALUES
  (2, 'transaction/ipad.jpg', 0);

-- ----- 채팅방 + 참여자 + 메시지 -----
INSERT INTO chat_rooms (id, name, item_id) VALUES
  (1, '전공 교재 (경제학원론) 팝니다 거래', 1);
INSERT INTO chat_room_members (room_id, user_id) VALUES
  (1, 2),
  (1, 4);
INSERT INTO chat_messages (room_id, sender_id, body) VALUES
  (1, 4, '혹시 직거래 가능하실까요?');

-- ----- 쪽지 -----
INSERT INTO notes (from_id, to_id, body, is_read) VALUES
  (4, 2, '글 잘 봤어요! 스터디 같이 하실래요?', FALSE);

-- ----- 문의 (운영자(1) 답변 포함) -----
INSERT INTO inquiries (id, user_id, title, body, answer, answered_by) VALUES
  (1, 2, '인증 메일이 안 와요', '학교 이메일로 인증 코드가 오지 않습니다.', '스팸함을 확인해 주세요. 그래도 없으면 다시 문의 부탁드립니다.', 1);

-- ============================================================
-- 자동 번호(시퀀스)를 지금 데이터의 최댓값 다음으로 맞춰줍니다.
--  (이걸 안 하면 다음에 INSERT 할 때 id 1 부터 다시 만들려다 충돌나요)
-- ============================================================
SELECT setval('users_id_seq',         (SELECT MAX(id) FROM users));
SELECT setval('posts_id_seq',          (SELECT MAX(id) FROM posts));
SELECT setval('post_images_id_seq',    (SELECT MAX(id) FROM post_images));
SELECT setval('comments_id_seq',       (SELECT MAX(id) FROM comments));
SELECT setval('meetups_id_seq',        (SELECT MAX(id) FROM meetups));
SELECT setval('meetup_posts_id_seq',   (SELECT MAX(id) FROM meetup_posts));
SELECT setval('meetup_greetings_id_seq',(SELECT MAX(id) FROM meetup_greetings));
SELECT setval('meetup_messages_id_seq',(SELECT MAX(id) FROM meetup_messages));
SELECT setval('market_items_id_seq',   (SELECT MAX(id) FROM market_items));
SELECT setval('item_images_id_seq',    (SELECT MAX(id) FROM item_images));
SELECT setval('chat_rooms_id_seq',     (SELECT MAX(id) FROM chat_rooms));
SELECT setval('chat_messages_id_seq',  (SELECT MAX(id) FROM chat_messages));
SELECT setval('notes_id_seq',          (SELECT MAX(id) FROM notes));
SELECT setval('inquiries_id_seq',      (SELECT MAX(id) FROM inquiries));

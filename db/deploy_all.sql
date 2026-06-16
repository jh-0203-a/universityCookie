-- 청년와글 전체 DB 셋업 (schema + seed + 모든 마이그레이션). Supabase SQL Editor 에 전체 붙여넣고 Run.

-- >>>>>>>>>>>>>>>>>>>>  schema.postgresql.sql  >>>>>>>>>>>>>>>>>>>>
-- ============================================================
-- 청년와글 앱 데이터베이스 스키마 (PostgreSQL 버전)
--  - MySQL 버전(schema.sql)을 PostgreSQL 문법으로 바꾼 것입니다.
--  - 주요 차이:
--      AUTO_INCREMENT      → BIGSERIAL (자동 증가 번호)
--      ENUM('a','b')       → VARCHAR + CHECK (정해진 값만 허용)
--      DATETIME            → TIMESTAMP
--      CREATE DATABASE/USE → psql 에서 따로 실행 (아래 [실행 방법] 참고)
--      문자셋(utf8mb4)      → PostgreSQL 은 기본이 UTF8 이라 한글 그대로 OK
--
-- [실행 방법]
--  1) 먼저 DB를 만들고 접속합니다 (psql 에서):
--        CREATE DATABASE cookie_db;
--        \c cookie_db
--  2) 그 다음 이 파일 전체를 블록으로 잡아 한 번에 실행하면 됩니다.
--     (또는 터미널에서)  psql -U postgres -d cookie_db -f db/schema.postgresql.sql
--
-- [사진 저장 방식]  (사용자 제안 폴더 구조 반영)
--  - 사진 "파일"은 DB가 아니라 디스크 폴더에 저장하고, DB에는 "경로(주소)"만 저장합니다.
--      D:\Cookie_db\profile      → 프로필 사진      (users.avatar_url)
--      D:\Cookie_db\board        → 게시판 글 사진    (post_images.url)
--      D:\Cookie_db\ask          → 문의 사진         (inquiry_images.url)
--      D:\Cookie_db\transaction  → 중고거래 상품 사진 (item_images.url)
--      D:\Cookie_db\group        → 모임 관련 사진     (meetup_post_images.url 등)
--      D:\Cookie_db\report       → 신고된 사진        (report_images.url)
--      D:\Cookie_db\verification → 졸업증명서          (verifications.cert_url)
--      D:\Cookie_db\etc          → 채팅/기타 사진     (chat_messages.image_url 등)
-- ============================================================

-- ----------------------------------------------------------------
-- [초기화] 처음부터 다시 만들 때만 주석을 풀어 먼저 실행 (기존 데이터 모두 삭제!)
--  - PostgreSQL 은 CASCADE 가 있어서 순서 신경 안 써도 됩니다.
-- ----------------------------------------------------------------
-- DROP TABLE IF EXISTS
--   notifications, reports, inquiry_images, inquiries, notes,
--   chat_messages, chat_room_members, chat_rooms, item_images, market_items,
--   meetup_greetings, meetup_messages, meetup_post_images, meetup_posts, meetup_members, meetups,
--   boards, post_likes, comments, post_images, posts, users
--   CASCADE;

-- ----------------------------------------------------------------
-- 1) 회원 (모든 기능의 중심)
-- ----------------------------------------------------------------
CREATE TABLE users (
  id             BIGSERIAL PRIMARY KEY,
  nickname       VARCHAR(50)  NOT NULL,
  email          VARCHAR(255) NOT NULL UNIQUE,   -- 이메일 (로그인 ID)
  password_hash  VARCHAR(255) NOT NULL,          -- 비밀번호는 반드시 "암호화(해시)"해서 저장
  phone          VARCHAR(20),                     -- 휴대폰 번호 (가입 시 본인인증) — 1인 1계정
  phone_verified BOOLEAN NOT NULL DEFAULT FALSE,  -- 휴대폰 본인인증 완료 여부
  school         VARCHAR(100),                    -- 졸업 학교
  grad_year      VARCHAR(10),                     -- 졸업 연도 (예: '2022') — 졸업생 커뮤니티 특성
  region         VARCHAR(100),
  avatar_url     VARCHAR(500),                    -- 프로필 사진 경로
  role           VARCHAR(10) NOT NULL DEFAULT '회원'  CHECK (role IN ('회원','관리자')),
  verified       BOOLEAN NOT NULL DEFAULT FALSE,  -- 대학 인증(🎓) 완료 여부 (선택 — 닉네임 옆 배지)
  school_method  VARCHAR(50),                     -- 대학 인증을 받은 수단 ('대학교 이메일'/'졸업증명서' 등 — 배지 차별화)
  region_verified BOOLEAN NOT NULL DEFAULT FALSE, -- 지역 인증(📍) 완료 여부 (선택 — 닉네임 옆 배지)
  cert_url       VARCHAR(500),                    -- 제출한 인증 서류 사진 경로(선택)
  status         VARCHAR(10) NOT NULL DEFAULT '정상'  CHECK (status IN ('정상','정지','탈퇴')),
  -- 정지 회원용 정보 (정지가 아니면 NULL)
  suspend_reason VARCHAR(255),
  suspend_period VARCHAR(10) CHECK (suspend_period IN ('1달','6달','1년','2년','5년')),
  suspend_until  DATE,                            -- 정지 해제 예정일
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 휴대폰 번호는 "1인 1계정"을 위해 중복 금지 (번호 없는 기존 회원 NULL 은 여러 개 허용)
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON users(phone) WHERE phone IS NOT NULL;

-- ----------------------------------------------------------------
-- 2) 커뮤니티 게시글 / 사진(최대 5장) / 댓글 / 좋아요
-- ----------------------------------------------------------------
CREATE TABLE posts (
  id          BIGSERIAL PRIMARY KEY,
  author_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 익명이어도 내부적으로 작성자 저장(신고/제재용)
  board_type  VARCHAR(50) NOT NULL,               -- '자유','익명','학교별' + 앞으로 학생이 만든 게시판 이름
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  anonymous   BOOLEAN NOT NULL DEFAULT FALSE,     -- 화면에 '익명'으로 보일지 여부
  school      VARCHAR(100),                        -- 학교별 게시판에서 자동 표시할 학교
  region      VARCHAR(100),
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 게시글 사진 (한 글에 최대 5장 → 앱에서 5장으로 제한)
CREATE TABLE post_images (
  id        BIGSERIAL PRIMARY KEY,
  post_id   BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  url       VARCHAR(500) NOT NULL,                 -- D:\Cookie_db\board\... 의 경로
  sort      INT NOT NULL DEFAULT 0                 -- 사진 순서
);

CREATE TABLE comments (
  id          BIGSERIAL PRIMARY KEY,
  post_id     BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 좋아요는 "한 사람이 한 글에 한 번만" → (post_id, user_id) 조합을 기본키로 중복 방지
CREATE TABLE post_likes (
  post_id    BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id)                  -- 1인 1회 보장
);

-- 댓글 좋아요 (한 사람이 한 댓글에 한 번만)
CREATE TABLE comment_likes (
  comment_id BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (comment_id, user_id)
);

-- (앞으로) 학생이 직접 만드는 게시판 목록
CREATE TABLE boards (
  id          BIGSERIAL PRIMARY KEY,
  name        VARCHAR(50) NOT NULL UNIQUE,
  created_by  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pinned      BOOLEAN NOT NULL DEFAULT FALSE,      -- 고정해서 메인에 항상 보이게 할지
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------
-- 3) 모임 (모임 + 참여인원 + 게시판/공지 + 단체채팅 + 가입인사)
-- ----------------------------------------------------------------
CREATE TABLE meetups (
  id          BIGSERIAL PRIMARY KEY,
  title       VARCHAR(200) NOT NULL,
  meet_when   VARCHAR(100),                        -- 일정 (예: '6/15 (일) 오전 9시')
  place       VARCHAR(200),
  capacity    INT NOT NULL DEFAULT 10,             -- 모집 인원
  created_by  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 모임장
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 누가 어느 모임에 참여 중인지 (참여 인원 수 = COUNT)
CREATE TABLE meetup_members (
  meetup_id  BIGINT NOT NULL REFERENCES meetups(id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  joined_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (meetup_id, user_id)
);

-- 모임 안 게시판 글 (notice = TRUE 이면 공지글)
CREATE TABLE meetup_posts (
  id          BIGSERIAL PRIMARY KEY,
  meetup_id   BIGINT NOT NULL REFERENCES meetups(id) ON DELETE CASCADE,
  author_id   BIGINT NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  notice      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 모임 게시글 사진 (D:\Cookie_db\group\...)
CREATE TABLE meetup_post_images (
  id              BIGSERIAL PRIMARY KEY,
  meetup_post_id  BIGINT NOT NULL REFERENCES meetup_posts(id) ON DELETE CASCADE,
  url             VARCHAR(500) NOT NULL,
  sort            INT NOT NULL DEFAULT 0
);

-- 모임 단체 채팅 메시지 (사진 1장 첨부 가능)
CREATE TABLE meetup_messages (
  id          BIGSERIAL PRIMARY KEY,
  meetup_id   BIGINT NOT NULL REFERENCES meetups(id) ON DELETE CASCADE,
  sender_id   BIGINT NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  body        TEXT,
  image_url   VARCHAR(500),                        -- 사진만 보낼 수도 있음
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 모임 가입 인사
CREATE TABLE meetup_greetings (
  id          BIGSERIAL PRIMARY KEY,
  meetup_id   BIGINT NOT NULL REFERENCES meetups(id) ON DELETE CASCADE,
  author_id   BIGINT NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------
-- 4) 중고거래 (사진 여러 장 가능)
-- ----------------------------------------------------------------
CREATE TABLE market_items (
  id          BIGSERIAL PRIMARY KEY,
  seller_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  price       INT NOT NULL DEFAULT 0,
  place       VARCHAR(200),
  status      VARCHAR(10) NOT NULL DEFAULT '판매중' CHECK (status IN ('판매중','예약중','판매완료')),
  body        TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE item_images (
  id        BIGSERIAL PRIMARY KEY,
  item_id   BIGINT NOT NULL REFERENCES market_items(id) ON DELETE CASCADE,
  url       VARCHAR(500) NOT NULL,                 -- D:\Cookie_db\transaction\...
  sort      INT NOT NULL DEFAULT 0
);

-- ----------------------------------------------------------------
-- 5) 1:1 / 그룹 실시간 채팅 (메시지에 사진 1장 첨부 가능)
-- ----------------------------------------------------------------
CREATE TABLE chat_rooms (
  id          BIGSERIAL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  item_id     BIGINT REFERENCES market_items(id) ON DELETE SET NULL,  -- 거래에서 시작된 방이면 연결(선택)
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_room_members (
  room_id   BIGINT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id   BIGINT NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE chat_messages (
  id          BIGSERIAL PRIMARY KEY,
  room_id     BIGINT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id   BIGINT NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  body        TEXT,
  image_url   VARCHAR(500),                        -- D:\Cookie_db\etc\... (사진만 보낼 수도 있음)
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------
-- 6) 쪽지 (실시간 채팅과 별개인 1:1 메모)
-- ----------------------------------------------------------------
CREATE TABLE notes (
  id          BIGSERIAL PRIMARY KEY,
  from_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 보낸 사람
  to_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 받는 사람
  body        TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------
-- 7) 문의하기 (사진 최대 5장)
-- ----------------------------------------------------------------
CREATE TABLE inquiries (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  answer      TEXT,                                -- 관리자 답변 (없으면 NULL = 답변 대기 중)
  answered_by BIGINT REFERENCES users(id) ON DELETE SET NULL,  -- 답변한 관리자(선택)
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inquiry_images (
  id          BIGSERIAL PRIMARY KEY,
  inquiry_id  BIGINT NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  url         VARCHAR(500) NOT NULL,               -- D:\Cookie_db\ask\...
  sort        INT NOT NULL DEFAULT 0
);

-- ----------------------------------------------------------------
-- 8) 신고 기록
-- ----------------------------------------------------------------
CREATE TABLE reports (
  id            BIGSERIAL PRIMARY KEY,
  reporter_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 신고한 사람
  target_type   VARCHAR(20) NOT NULL CHECK (target_type IN ('user','post','comment','chat_room','market_item','meetup')),
  target_id     BIGINT,                            -- 신고 대상의 id (글/댓글/방 등)
  target_user   VARCHAR(50),                       -- 신고당한 사람 닉네임 (누굴 신고했는지)
  reason        VARCHAR(255),
  handled       BOOLEAN NOT NULL DEFAULT FALSE,    -- 관리자가 처리했는지
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 신고에 첨부된 사진 (D:\Cookie_db\report\...)
CREATE TABLE report_images (
  id         BIGSERIAL PRIMARY KEY,
  report_id  BIGINT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  url        VARCHAR(500) NOT NULL,
  sort       INT NOT NULL DEFAULT 0
);

-- ----------------------------------------------------------------
-- 8-2) 인증 요청 (관리자가 심사 → 승인 시 대학=users.verified, 지역=users.region_verified = TRUE)
-- ----------------------------------------------------------------
CREATE TABLE verifications (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(10) NOT NULL DEFAULT '대학' CHECK (type IN ('대학','지역')),  -- 인증 종류
  method      VARCHAR(50),                         -- 인증 수단 ('졸업증명서'/'대학교 이메일'/'주민등록증(뒷자리 가림)' 등)
  cert_url    VARCHAR(500) NOT NULL,               -- D:\Cookie_db\verification\... 의 서류 사진 경로
  status      VARCHAR(10) NOT NULL DEFAULT '대기' CHECK (status IN ('대기','승인','거절')),
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------
-- 9) 알림
-- ----------------------------------------------------------------
CREATE TABLE notifications (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 알림 받을 사람
  type        VARCHAR(50) NOT NULL,                -- 예: 'comment','note'
  message     VARCHAR(255) NOT NULL,
  post_id     BIGINT REFERENCES posts(id) ON DELETE CASCADE,  -- 누르면 이동할 글(선택)
  note_with   VARCHAR(50),                          -- 누르면 이동할 쪽지 상대(선택)
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- >>>>>>>>>>>>>>>>>>>>  seed.postgresql.sql  >>>>>>>>>>>>>>>>>>>>
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


-- >>>>>>>>>>>>>>>>>>>>  migrate_phone_auth.postgresql.sql  >>>>>>>>>>>>>>>>>>>>
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


-- >>>>>>>>>>>>>>>>>>>>  migrate_youth_badges.postgresql.sql  >>>>>>>>>>>>>>>>>>>>
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


-- >>>>>>>>>>>>>>>>>>>>  migrate_meetup_db.postgresql.sql  >>>>>>>>>>>>>>>>>>>>
-- ============================================================
-- 청년와글 마이그레이션: 모임 가입 승인제 + 가입 신청 테이블
--  - meetups.require_approval : 켜면 모임장 승인을 받아야 가입됨
--  - meetup_join_requests     : 승인제 모임의 가입 신청 (신청자 + 소개)
--  - 여러 번 실행해도 안전합니다.
-- ============================================================

ALTER TABLE meetups ADD COLUMN IF NOT EXISTS require_approval BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS meetup_join_requests (
  id            BIGSERIAL PRIMARY KEY,
  meetup_id     BIGINT NOT NULL REFERENCES meetups(id) ON DELETE CASCADE,
  applicant_id  BIGINT NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  intro         TEXT,                                   -- 신청자가 적은 간단한 소개
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (meetup_id, applicant_id)                       -- 한 모임에 한 사람 한 번만 신청
);


-- >>>>>>>>>>>>>>>>>>>>  migrate_reports_label.postgresql.sql  >>>>>>>>>>>>>>>>>>>>
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


-- >>>>>>>>>>>>>>>>>>>>  migrate_region_city.postgresql.sql  >>>>>>>>>>>>>>>>>>>>
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


-- >>>>>>>>>>>>>>>>>>>>  migrate_meetup_poll.postgresql.sql  >>>>>>>>>>>>>>>>>>>>
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


-- >>>>>>>>>>>>>>>>>>>>  migrate_item_comments.postgresql.sql  >>>>>>>>>>>>>>>>>>>>
-- 중고거래(판매글) 댓글 테이블
-- 게시글 댓글(comments)과 같은 구조이며, 상품(market_items)에 달립니다.
CREATE TABLE IF NOT EXISTS item_comments (
  id          BIGSERIAL PRIMARY KEY,
  item_id     BIGINT NOT NULL REFERENCES market_items(id) ON DELETE CASCADE,
  author_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- >>>>>>>>>>>>>>>>>>>>  migrate_chat_purpose.postgresql.sql  >>>>>>>>>>>>>>>>>>>>
-- 목적이 있는 채팅방: 개설 시 목적(purpose)과 인원 제한(capacity, 최대 100명)을 저장
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS purpose VARCHAR(40);
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS capacity INT;


-- >>>>>>>>>>>>>>>>>>>>  migrate_board_favorites.postgresql.sql  >>>>>>>>>>>>>>>>>>>>
-- 개인 게시판 고정(즐겨찾기): 회원이 특정 게시판을 자기 화면에 계속 고정해 둘 수 있게
-- 기본 게시판(자유/익명/학교별/취업)은 boards 테이블에 없으므로 '이름'으로 보관합니다.
CREATE TABLE IF NOT EXISTS board_favorites (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  board_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, board_name)
);


-- >>>>>>>>>>>>>>>>>>>>  migrate_comment_replies.postgresql.sql  >>>>>>>>>>>>>>>>>>>>
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


-- >>>>>>>>>>>>>>>>>>>>  migrate_region_board.postgresql.sql  >>>>>>>>>>>>>>>>>>>>
-- 지역별 게시판: 글에 작성자의 거주지(시/군/구)를 저장해, 같은 지역(수원권/강남권/부평권)끼리만 보게 합니다.
-- region_city 예: '경기도 수원시', '서울특별시 강남구', '인천광역시 부평구'
ALTER TABLE posts ADD COLUMN IF NOT EXISTS region_city VARCHAR(60);


-- >>>>>>>>>>>>>>>>>>>>  migrate_real_identity.postgresql.sql  >>>>>>>>>>>>>>>>>>>>
-- 본인 확인용 실명/생년월일 — 휴대폰 본인인증(PASS류)으로 확인되는 정보입니다.
-- 지역 인증(주민등록증) 심사 때 관리자가 이 값과 서류를 대조해 실효성을 높입니다.
ALTER TABLE users ADD COLUMN IF NOT EXISTS real_name VARCHAR(40); -- 실명
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth     VARCHAR(20); -- 생년월일 (예: '1999-03-15')



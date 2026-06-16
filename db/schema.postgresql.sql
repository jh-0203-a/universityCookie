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

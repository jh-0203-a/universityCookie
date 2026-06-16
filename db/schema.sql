-- ============================================================
-- 대학생쿠키 앱 데이터베이스 스키마 (MySQL 기준)
--  - 지금까지 앱(localStorage)에서 쓰던 데이터를 실제 DB 테이블로 옮긴 것입니다.
--  - 한 줄 요약: 사람(users)을 중심으로 글/모임/거래/채팅/쪽지가 연결됩니다.
--  - FK(외래키) = "이 값은 다른 표의 id를 가리킨다"는 연결 고리입니다.
--
-- [사진 저장 방식]  (사용자 제안 폴더 구조 반영)
--  - 사진 "파일"은 DB가 아니라 디스크 폴더에 저장하고, DB에는 그 "경로(주소)"만 저장합니다.
--    (DB에 사진을 통째로 넣으면 무거워지고 느려져요. 지금 localStorage 가 꽉 차서
--     흰 화면이 났던 것과 같은 이유입니다.)
--  - 카테고리별 폴더:
--      D:\Cookie_db\profile      → 사용자 프로필 사진      (users.avatar_url)
--      D:\Cookie_db\board        → 게시판 글 사진          (post_images.url)
--      D:\Cookie_db\ask          → 문의 사진               (inquiry_images.url)
--      D:\Cookie_db\transaction  → 중고거래 상품 사진       (item_images.url)
--      D:\Cookie_db\group        → 모임 관련 사진           (meetup_post_images.url 등)
--      D:\Cookie_db\etc          → 채팅/기타 사진           (chat_messages.image_url 등)
--  - url 컬럼에는 예: 'board/1699999999_abc.jpg' 처럼 폴더+파일명을 넣고,
--    실제 파일은 D:\Cookie_db\board\1699999999_abc.jpg 로 저장하면 됩니다.
-- ============================================================

-- ----------------------------------------------------------------
-- 0) 데이터베이스 준비 (제일 먼저 실행됨)
--  - 한글 저장을 위해 utf8mb4 사용. 아래 전체를 블록으로 잡아 한 번에 실행하면 됩니다.
-- ----------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS cookie_db
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE cookie_db;

-- ----------------------------------------------------------------
-- 1) 회원 (모든 기능의 중심)
-- ----------------------------------------------------------------
CREATE TABLE users (
  id             BIGINT PRIMARY KEY AUTO_INCREMENT,
  nickname       VARCHAR(50)  NOT NULL,
  email          VARCHAR(255) NOT NULL UNIQUE,   -- 학교 이메일 (로그인 ID)
  password_hash  VARCHAR(255) NOT NULL,          -- 비밀번호는 반드시 "암호화(해시)"해서 저장
  school         VARCHAR(100),
  region         VARCHAR(100),
  avatar_url     VARCHAR(500),                    -- 프로필 사진 경로 (D:\Cookie_db\profile\...)
  grad_year      VARCHAR(10),                     -- 졸업 연도 (예: '2022') — 졸업생 커뮤니티 특성
  role           ENUM('회원','관리자') NOT NULL DEFAULT '회원',  -- 관리자도 같은 표에 두고 role 로 구분
  verified       BOOLEAN NOT NULL DEFAULT FALSE,  -- 졸업증명서 인증 완료 여부
  grad_cert_url  VARCHAR(500),                    -- 제출한 졸업증명서 사진 경로(선택)
  status         ENUM('정상','정지','탈퇴') NOT NULL DEFAULT '정상',
  -- 정지 회원용 정보 (정지가 아니면 NULL)
  suspend_reason VARCHAR(255),
  suspend_period ENUM('1달','6달','1년','2년','5년'),
  suspend_until  DATE,                            -- 정지 해제 예정일
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------
-- 2) 커뮤니티 게시글 / 사진(최대 5장) / 댓글 / 좋아요
-- ----------------------------------------------------------------
CREATE TABLE posts (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  author_id   BIGINT NOT NULL,                    -- 작성자 (익명이어도 내부적으로는 누구인지 저장 → 신고/제재용)
  board_type  VARCHAR(50) NOT NULL,               -- '자유','익명','학교별' + 앞으로 학생이 만든 게시판 이름
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  anonymous   BOOLEAN NOT NULL DEFAULT FALSE,     -- 화면에 '익명'으로 보일지 여부
  school      VARCHAR(100),                        -- 학교별 게시판에서 자동 표시할 학교
  region      VARCHAR(100),
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 게시글 사진 (한 글에 최대 5장 → 앱에서 5장으로 제한)
CREATE TABLE post_images (
  id        BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id   BIGINT NOT NULL,
  url       VARCHAR(500) NOT NULL,                 -- D:\Cookie_db\board\... 의 경로
  sort      INT NOT NULL DEFAULT 0,                -- 사진 순서
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE TABLE comments (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id     BIGINT NOT NULL,
  author_id   BIGINT NOT NULL,
  body        TEXT NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id)   REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 좋아요는 "한 사람이 한 글에 한 번만" 누를 수 있어야 하므로 별도 표로 관리합니다.
-- (글의 좋아요 수 = 이 표에서 post_id 로 COUNT 한 값)
CREATE TABLE post_likes (
  post_id   BIGINT NOT NULL,
  user_id   BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id),                 -- 이 조합이 중복 불가 → 1인 1회 보장
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 댓글 좋아요 (한 사람이 한 댓글에 한 번만)
CREATE TABLE comment_likes (
  comment_id BIGINT NOT NULL,
  user_id    BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (comment_id, user_id),
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE
);

-- (앞으로) 학생이 직접 만드는 게시판 목록
CREATE TABLE boards (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(50) NOT NULL UNIQUE,
  created_by  BIGINT NOT NULL,
  pinned      BOOLEAN NOT NULL DEFAULT FALSE,      -- 고정해서 메인에 항상 보이게 할지
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------
-- 3) 모임 (모임 + 참여인원 + 게시판/공지 + 단체채팅 + 가입인사)
-- ----------------------------------------------------------------
CREATE TABLE meetups (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  title       VARCHAR(200) NOT NULL,
  meet_when   VARCHAR(100),                        -- 일정 (예: '6/15 (일) 오전 9시')
  place       VARCHAR(200),
  capacity    INT NOT NULL DEFAULT 10,             -- 모집 인원
  created_by  BIGINT NOT NULL,                     -- 모임장
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 누가 어느 모임에 참여 중인지 (참여 인원 수 = 이 표에서 COUNT)
CREATE TABLE meetup_members (
  meetup_id  BIGINT NOT NULL,
  user_id    BIGINT NOT NULL,
  joined_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (meetup_id, user_id),
  FOREIGN KEY (meetup_id) REFERENCES meetups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
);

-- 모임 안 게시판 글 (notice = TRUE 이면 공지글)
CREATE TABLE meetup_posts (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  meetup_id   BIGINT NOT NULL,
  author_id   BIGINT NOT NULL,
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  notice      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meetup_id) REFERENCES meetups(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)   ON DELETE CASCADE
);

-- 모임 게시글 사진 (D:\Cookie_db\group\...)
CREATE TABLE meetup_post_images (
  id              BIGINT PRIMARY KEY AUTO_INCREMENT,
  meetup_post_id  BIGINT NOT NULL,
  url             VARCHAR(500) NOT NULL,
  sort            INT NOT NULL DEFAULT 0,
  FOREIGN KEY (meetup_post_id) REFERENCES meetup_posts(id) ON DELETE CASCADE
);

-- 모임 단체 채팅 메시지 (사진 1장 첨부 가능)
CREATE TABLE meetup_messages (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  meetup_id   BIGINT NOT NULL,
  sender_id   BIGINT NOT NULL,
  body        TEXT,
  image_url   VARCHAR(500),                        -- D:\Cookie_db\group\... (사진만 보낼 수도 있음)
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meetup_id) REFERENCES meetups(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id)   ON DELETE CASCADE
);

-- 모임 가입 인사
CREATE TABLE meetup_greetings (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  meetup_id   BIGINT NOT NULL,
  author_id   BIGINT NOT NULL,
  body        TEXT NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meetup_id) REFERENCES meetups(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)   ON DELETE CASCADE
);

-- ----------------------------------------------------------------
-- 4) 중고거래 (사진 여러 장 가능)
-- ----------------------------------------------------------------
CREATE TABLE market_items (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  seller_id   BIGINT NOT NULL,
  title       VARCHAR(200) NOT NULL,
  price       INT NOT NULL DEFAULT 0,
  place       VARCHAR(200),
  status      ENUM('판매중','예약중','판매완료') NOT NULL DEFAULT '판매중',
  body        TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE item_images (
  id        BIGINT PRIMARY KEY AUTO_INCREMENT,
  item_id   BIGINT NOT NULL,
  url       VARCHAR(500) NOT NULL,                 -- D:\Cookie_db\transaction\...
  sort      INT NOT NULL DEFAULT 0,
  FOREIGN KEY (item_id) REFERENCES market_items(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------
-- 5) 1:1 / 그룹 실시간 채팅 (메시지에 사진 1장 첨부 가능)
-- ----------------------------------------------------------------
CREATE TABLE chat_rooms (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(200) NOT NULL,
  item_id     BIGINT,                              -- 중고거래에서 시작된 방이면 상품 연결 (선택)
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES market_items(id) ON DELETE SET NULL
);

CREATE TABLE chat_room_members (
  room_id   BIGINT NOT NULL,
  user_id   BIGINT NOT NULL,
  PRIMARY KEY (room_id, user_id),
  FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)      ON DELETE CASCADE
);

CREATE TABLE chat_messages (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  room_id     BIGINT NOT NULL,
  sender_id   BIGINT NOT NULL,
  body        TEXT,
  image_url   VARCHAR(500),                        -- D:\Cookie_db\etc\... (사진만 보낼 수도 있음)
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id)   REFERENCES chat_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id)      ON DELETE CASCADE
);

-- ----------------------------------------------------------------
-- 6) 쪽지 (실시간 채팅과 별개인 1:1 메모)
-- ----------------------------------------------------------------
CREATE TABLE notes (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  from_id     BIGINT NOT NULL,                     -- 보낸 사람
  to_id       BIGINT NOT NULL,                     -- 받는 사람
  body        TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,      -- 받은 사람이 읽었는지
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_id)   REFERENCES users(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------
-- 7) 문의하기 (사진 최대 5장)
-- ----------------------------------------------------------------
CREATE TABLE inquiries (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id     BIGINT NOT NULL,
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  answer      TEXT,                                -- 관리자 답변 (없으면 NULL = 답변 대기 중)
  answered_by BIGINT,                              -- 답변한 관리자 (선택)
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (answered_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE inquiry_images (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  inquiry_id  BIGINT NOT NULL,
  url         VARCHAR(500) NOT NULL,               -- D:\Cookie_db\ask\...
  sort        INT NOT NULL DEFAULT 0,
  FOREIGN KEY (inquiry_id) REFERENCES inquiries(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------
-- 8) 신고 기록 (채팅방/회원/게시글 등 신고)
-- ----------------------------------------------------------------
CREATE TABLE reports (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  reporter_id   BIGINT NOT NULL,                   -- 신고한 사람
  target_type   ENUM('user','post','comment','chat_room','market_item','meetup') NOT NULL,
  target_id     BIGINT,                            -- 신고 대상의 id (글/댓글/방 등)
  target_user   VARCHAR(50),                       -- 신고당한 사람 닉네임 (누굴 신고했는지)
  reason        VARCHAR(255),
  handled       BOOLEAN NOT NULL DEFAULT FALSE,    -- 관리자가 처리했는지
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 신고에 첨부된 사진 (D:\Cookie_db\report\...)
CREATE TABLE report_images (
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  report_id  BIGINT NOT NULL,
  url        VARCHAR(500) NOT NULL,
  sort       INT NOT NULL DEFAULT 0,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

-- 졸업 인증 요청 (관리자가 심사 → 승인 시 users.verified = TRUE)
CREATE TABLE verifications (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id     BIGINT NOT NULL,
  cert_url    VARCHAR(500) NOT NULL,               -- D:\Cookie_db\verification\... 의 졸업증명서 경로
  status      ENUM('대기','승인','거절') NOT NULL DEFAULT '대기',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------
-- 9) 알림
-- ----------------------------------------------------------------
CREATE TABLE notifications (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id     BIGINT NOT NULL,                     -- 알림을 받을 사람
  type        VARCHAR(50) NOT NULL,                -- 예: 'comment','note','meetup'
  message     VARCHAR(255) NOT NULL,
  link        VARCHAR(255),                         -- 누르면 이동할 위치 (선택)
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- [초기화] 처음부터 다시 만들고 싶을 때만 사용하세요.
--  - 아래 줄들의 맨 앞 '-- ' 를 지워서 주석을 풀고, "맨 위에서" 한 번 실행하면
--    기존 표와 데이터가 모두 지워집니다. (되돌릴 수 없어요!)
-- ============================================================
-- USE cookie_db;
-- SET FOREIGN_KEY_CHECKS = 0;
-- DROP TABLE IF EXISTS
--   notifications, reports, inquiry_images, inquiries, notes,
--   chat_messages, chat_room_members, chat_rooms, item_images, market_items,
--   meetup_greetings, meetup_messages, meetup_post_images, meetup_posts, meetup_members, meetups,
--   boards, post_likes, comments, post_images, posts, users;
-- SET FOREIGN_KEY_CHECKS = 1;

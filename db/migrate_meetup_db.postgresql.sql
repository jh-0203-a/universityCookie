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

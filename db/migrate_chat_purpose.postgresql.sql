-- 목적이 있는 채팅방: 개설 시 목적(purpose)과 인원 제한(capacity, 최대 100명)을 저장
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS purpose VARCHAR(40);
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS capacity INT;

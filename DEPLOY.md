# 청년와글 배포 가이드 (무료: Supabase + Render)

이 문서는 처음 배포하는 사람 기준으로, **클릭 순서대로** 적었습니다.
구조: **Supabase**(DB + 사진 저장) + **Render**(백엔드가 프론트도 같이 서빙) = 공개 URL 1개.

> 코드 쪽 준비(2~6번 작업)는 이미 끝나 있습니다. 아래는 "계정 만들고 연결"만 하면 됩니다.

---

## 1단계. GitHub에 코드 올리기 (Render가 여기서 코드를 가져감)

1. https://github.com 가입/로그인 → 우측 위 `+` → **New repository**
2. 이름: `cheongnyeon-wagle` (아무거나), **Private** 추천 → Create
3. 내 PC 터미널에서 (프로젝트 폴더):
   ```
   git add -A
   git commit -m "배포 준비"
   git remote add origin https://github.com/<내아이디>/cheongnyeon-wagle.git
   git push -u origin main
   ```
   - `.env`(비밀번호)는 `.gitignore` 덕분에 **안 올라갑니다.** (`.env.example`만 올라감)

---

## 2단계. Supabase = 데이터베이스 + 사진 저장소

### 2-1. 프로젝트 생성
1. https://supabase.com 가입 → **New project**
2. 이름/지역(Region: `Northeast Asia (Seoul)`) 선택, **DB 비밀번호**를 정하고 **메모해 두세요.**
3. 생성까지 1~2분 대기.

### 2-2. 테이블 만들기 (스키마 + 마이그레이션)
1. 좌측 메뉴 **SQL Editor** → New query
2. 프로젝트의 `db/` 폴더 파일들을 **순서대로** 복사해 붙여넣고 Run:
   `schema.postgresql.sql` → `seed.postgresql.sql`(샘플 데이터, 원하면 생략) →
   `migrate_phone_auth` → `migrate_youth_badges` → `migrate_meetup_db` →
   `migrate_reports_label` → `migrate_region_city` → `migrate_meetup_poll` →
   `migrate_item_comments` → `migrate_chat_purpose` → `migrate_board_favorites` →
   `migrate_comment_replies` → `migrate_region_board` → `migrate_real_identity`
   (한 파일씩 붙여넣고 Run을 반복)

### 2-3. 연결문자열(DATABASE_URL) 복사
1. 좌측 **Project Settings(톱니) → Database → Connection string → URI** 복사
2. 문자열 안의 `[YOUR-PASSWORD]` 를 2-1에서 정한 DB 비밀번호로 바꿔두세요. → 나중에 Render에 넣습니다.

### 2-4. 사진 버킷 만들기
1. 좌측 **Storage → New bucket**
2. 이름: `photos`, **Public bucket 켜기(ON)** → Create
3. **Project Settings → API** 에서 두 값을 메모:
   - `Project URL` (예: `https://xxxx.supabase.co`) → `SUPABASE_URL`
   - `service_role` 키(secret) → `SUPABASE_SERVICE_KEY` (**절대 공개 금지**)
   - 버킷 이름 `photos` → `SUPABASE_BUCKET`

---

## 3단계. Render = 서버 실행 (백엔드 + 프론트)

1. https://render.com 가입 → **New + → Web Service** → 1단계의 GitHub 저장소 연결
2. 설정:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run server`
   - **Instance Type**: Free
3. **Environment**(환경변수)에 아래를 추가:
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | 2-3에서 만든 연결문자열 |
   | `SUPABASE_URL` | 2-4의 Project URL |
   | `SUPABASE_SERVICE_KEY` | 2-4의 service_role 키 |
   | `SUPABASE_BUCKET` | `photos` |
   (`PORT`는 Render가 자동으로 넣어줍니다. 따로 안 넣어도 됨)
4. **Create Web Service** → 빌드·배포 로그가 끝나면 `https://<이름>.onrender.com` 주소가 나옵니다. 그게 공개 URL!

---

## 동작 원리 한 줄 요약
- `DATABASE_URL` 이 있으면 서버가 **클라우드 DB**에 접속하고,
- `SUPABASE_URL/KEY/BUCKET` 3개가 있으면 사진을 **Supabase Storage**에 올립니다.
- 세 개 다 없으면(내 PC) 예전처럼 로컬 PostgreSQL + `D:\Cookie_db` 폴더로 동작합니다. → **로컬/배포 코드가 동일**.

## 무료의 제약 (알고 쓰기)
- Render 무료: 15분간 아무도 안 들어오면 서버가 잠들어서 **다음 첫 접속이 30~60초** 느립니다. (월 $7 유료로 바꾸면 항상 켜짐)
- Supabase 무료: 일주일 미접속 시 DB 일시정지(접속하면 깨어남), 저장 500MB·사진 1GB.

## 남은 보안 TODO (진짜 운영 전에)
- 샘플(시드) 계정은 비밀번호 검증을 건너뜁니다(`password_hash = 'TEST_HASH'`). 실서비스에선 시드 계정을 빼거나 비활성화하세요.
- 휴대폰 OTP가 지금은 "개발용 번호"로 화면에 보입니다. 실제 문자 발송은 CoolSMS/알리고 같은 발송사 연동이 필요합니다.
- 인증 사진(주민등록증 등) 7일 자동삭제는 로컬 모드만 동작합니다. 클라우드는 추후 Supabase에서 정리 로직 필요.

// ============================================================
// 대학생쿠키 백엔드 서버 (Express + PostgreSQL)
//  - 회원가입/로그인 (비밀번호는 bcrypt 해시로 저장)
//  - 사진/졸업증명서 업로드 → D:\Cookie_db\<폴더> 에 저장하고 경로(URL)만 DB에 보관
//  - 실행:  npm run server   (프런트는 npm run dev, /api 는 vite 가 이 서버로 넘겨줌)
// ============================================================
import express from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 4000;
const COOKIE_DB_DIR = process.env.COOKIE_DB_DIR || 'D:\\Cookie_db';

// 사진을 클라우드(Supabase Storage)에 저장할지 여부.
//  - 배포 환경에선 서버 디스크가 재배포마다 비워지므로 Supabase Storage 에 올립니다.
//  - 아래 3개 환경변수가 모두 있으면 클라우드 모드, 없으면 로컬 폴더 저장(개발용)입니다.
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || '';
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_SERVICE_KEY && SUPABASE_BUCKET);

// 카테고리별 업로드 폴더 (요청 시 이 안에서만 허용)
const UPLOAD_FOLDERS = ['profile', 'board', 'ask', 'transaction', 'group', 'report', 'verification', 'etc'];

// 로컬 저장 모드일 때만, 폴더가 없으면 만들어 둡니다. (클라우드 모드면 디스크를 쓰지 않습니다)
if (!USE_SUPABASE) {
  for (const f of UPLOAD_FOLDERS) {
    try {
      fs.mkdirSync(path.join(COOKIE_DB_DIR, f), {recursive: true});
    } catch (e) {
      console.warn('업로드 폴더 생성 실패(무시):', f, String(e));
    }
  }
}

// 인증 사진(주민등록증·증명서 등)은 민감정보라, 7일 지난 파일을 자동으로 삭제합니다.
// (서버 시작 시 한 번 + 6시간마다 반복)
function cleanupVerificationFiles() {
  const dir = path.join(COOKIE_DB_DIR, 'verification');
  try {
    for (const f of fs.readdirSync(dir)) {
      const fp = path.join(dir, f);
      if (Date.now() - fs.statSync(fp).mtimeMs > 7 * 24 * 60 * 60 * 1000) {
        fs.unlinkSync(fp);
        console.log('🗑  인증 사진 7일 경과 → 자동 삭제:', f);
      }
    }
  } catch {
    // 폴더가 비어있거나 접근 불가하면 조용히 넘어갑니다.
  }
}
// 로컬(디스크) 저장 모드에서만 동작. (클라우드 모드의 인증사진 정리는 추후 Supabase 에서 처리)
if (!USE_SUPABASE) {
  cleanupVerificationFiles();
  setInterval(cleanupVerificationFiles, 6 * 60 * 60 * 1000);
}

// --- PostgreSQL 연결 풀 ---
//  - 배포(클라우드)에선 DATABASE_URL 연결문자열 하나로 접속합니다. (Supabase/Render 등이 이 형식으로 줍니다)
//    클라우드 DB는 보통 SSL 을 요구하므로 ssl 옵션을 켭니다.
//  - 로컬 개발에선 DATABASE_URL 이 없으니 기존처럼 개별 변수(PGHOST 등)로 접속합니다.
const pool = process.env.DATABASE_URL
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {rejectUnauthorized: false},
    })
  : new pg.Pool({
      host: process.env.PGHOST || '127.0.0.1',
      port: Number(process.env.PGPORT) || 5432,
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || undefined,
      database: process.env.PGDATABASE || 'cookie_db',
    });

const app = express();
app.use(express.json({limit: '5mb'}));

// 로컬 저장 모드에서만, 업로드된 파일을 웹에서 볼 수 있게 제공 (예: /files/board/abc.jpg)
// 클라우드(Supabase) 모드에선 사진 주소가 Supabase 공개 URL 이라 이 경로가 필요 없습니다.
if (!USE_SUPABASE) {
  app.use('/files', express.static(COOKIE_DB_DIR));
}

// --- 파일 업로드 (multer) : POST /api/upload/:folder ---
//  - 로컬 모드: 디스크(COOKIE_DB_DIR)에 저장 → /files/... 경로 반환
//  - 클라우드 모드: 메모리에 받아 Supabase Storage 에 올림 → 공개 URL 반환
const storage = USE_SUPABASE
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, _file, cb) => {
        const folder = UPLOAD_FOLDERS.includes(req.params.folder) ? req.params.folder : 'etc';
        cb(null, path.join(COOKIE_DB_DIR, folder));
      },
      filename: (_req, file, cb) => {
        // 겹치지 않는 파일명 (시간 + 원래 확장자)
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
      },
    });
const upload = multer({storage, limits: {fileSize: 10 * 1024 * 1024}});

app.post('/api/upload/:folder', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({error: '파일이 없습니다.'});
  const folder = UPLOAD_FOLDERS.includes(req.params.folder) ? req.params.folder : 'etc';

  // 로컬 모드: 디스크에 이미 저장됨 → 정적 제공 경로를 돌려줍니다.
  if (!USE_SUPABASE) {
    return res.json({url: `/files/${folder}/${req.file.filename}`});
  }

  // 클라우드 모드: 받은 버퍼를 Supabase Storage 에 업로드합니다. (별도 라이브러리 없이 REST 호출)
  try {
    const ext = path.extname(req.file.originalname) || '.jpg';
    const objectPath = `${folder}/${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`;
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${objectPath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
        'Content-Type': req.file.mimetype || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: req.file.buffer,
    });
    if (!up.ok) {
      const msg = await up.text().catch(() => '');
      return res.status(500).json({error: `업로드 실패: ${up.status} ${msg}`});
    }
    // 버킷이 public 이면 이 주소로 바로 볼 수 있습니다.
    res.json({url: `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${objectPath}`});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// --- 헬스 체크 ---
app.get('/api/health', async (_req, res) => {
  try {
    const r = await pool.query('SELECT NOW() AS now');
    res.json({ok: true, now: r.rows[0].now});
  } catch (e) {
    res.status(500).json({ok: false, error: String(e)});
  }
});

// --- 휴대폰 본인인증 (문자 OTP) ---
// ※ 실제 서비스에선 CoolSMS·알리고 같은 SMS 발송사(또는 PASS 본인인증 PG)로 보냅니다.
//   지금은 발송사 계약/키가 없어 인증번호를 "개발용"으로 응답/서버로그에 보여줘 테스트하게 합니다.
//   실서비스 전환 시: send-otp 안에서 SMS 발송사 API 를 호출하고, 응답의 devCode 는 삭제하세요.
const otpStore = new Map(); // phone -> { code, expires, verified }
const OTP_TTL_MS = 3 * 60 * 1000; // 인증번호 유효시간 3분

function normPhone(p) {
  return String(p || '').replace(/[^0-9]/g, ''); // 숫자만 남김 (010-1234-5678 → 01012345678)
}

// --- 문자(SMS) 발송 횟수 제한 (문자 과금·도배 방지) ---
//  - 같은 번호로 1분에 1회, 하루(24시간) 5회까지만 발송 허용.
//  - 메일은 비용이 거의 없어 제한하지 않습니다.
const sendLog = new Map(); // key('phone:01012345678') -> 발송 시각(ms) 배열
const RESEND_COOLDOWN_MS = 60 * 1000; // 재발송 최소 간격 1분
const DAILY_LIMIT = 5; // 24시간 내 최대 발송 횟수

function checkSendLimit(key) {
  const now = Date.now();
  const times = (sendLog.get(key) || []).filter((t) => now - t < 24 * 60 * 60 * 1000); // 최근 24시간 기록만
  const last = times[times.length - 1];
  if (last && now - last < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - last)) / 1000);
    return {ok: false, error: `너무 자주 보냈어요. ${wait}초 후에 다시 시도해 주세요.`};
  }
  if (times.length >= DAILY_LIMIT) {
    return {ok: false, error: `하루 발송 한도(${DAILY_LIMIT}회)를 넘었어요. 내일 다시 시도해 주세요.`};
  }
  times.push(now);
  sendLog.set(key, times);
  return {ok: true};
}

// 인증번호 보내기
app.post('/api/send-otp', (req, res) => {
  const phone = normPhone(req.body?.phone);
  if (phone.length < 10) return res.status(400).json({error: '휴대폰 번호를 정확히 입력해 주세요.'});
  // 발송 횟수 제한 확인 (1분 1회 / 하루 5회)
  const limit = checkSendLimit(`phone:${phone}`);
  if (!limit.ok) return res.status(429).json({error: limit.error});
  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6자리
  otpStore.set(phone, {code, expires: Date.now() + OTP_TTL_MS, verified: false});
  console.log(`📱 [본인인증] ${phone} 인증번호: ${code} (개발용)`);
  res.json({ok: true, devCode: code}); // devCode: 개발용. 실서비스에선 빼고 문자로 발송.
});

// 인증번호 확인 — 본인인증(PASS류)은 실명·생년월일도 함께 확인되므로 같이 받아 저장합니다.
// 여기서 확정된 실명/생년월일이 회원가입의 "본인 확인된 정보"가 됩니다.
app.post('/api/verify-otp', (req, res) => {
  const phone = normPhone(req.body?.phone);
  const code = String(req.body?.code || '').trim();
  const realName = String(req.body?.realName || '').trim();
  const birth = String(req.body?.birth || '').trim();
  const rec = otpStore.get(phone);
  if (!rec) return res.status(400).json({error: '먼저 인증번호를 요청해 주세요.'});
  if (Date.now() > rec.expires) return res.status(400).json({error: '인증번호가 만료됐어요. 다시 요청해 주세요.'});
  if (rec.code !== code) return res.status(400).json({error: '인증번호가 일치하지 않아요.'});
  if (!realName || !birth) return res.status(400).json({error: '실명과 생년월일을 입력해 주세요.'});
  // 본인인증으로 확인된 신원 정보를 저장 (회원가입 때 이 값과 일치해야 함)
  rec.verified = true;
  rec.realName = realName;
  rec.birth = birth;
  res.json({ok: true, realName, birth});
});

// --- 대학교 이메일 인증 (학교 이메일로 코드 발송 → 앱에서 코드 입력 → 자동 인증) ---
// ※ 실제 발송도 SMS 처럼 메일 발송사(nodemailer+SMTP, SendGrid 등)가 필요합니다.
//   지금은 발송사가 없어 devCode 로 코드를 돌려줘 테스트합니다. (실서비스 전환 시 devCode 제거 + 메일 발송)
const emailOtpStore = new Map(); // schoolEmail -> { code, expires }

function isSchoolEmail(email) {
  return /\.ac\.kr$/i.test(String(email || '').trim()); // 한국 대학 이메일 (@xxx.ac.kr)
}

// 학교 이메일로 인증코드 보내기
app.post('/api/send-email-otp', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!isSchoolEmail(email)) return res.status(400).json({error: '학교 이메일(@xxx.ac.kr)을 입력해 주세요.'});
  // 메일은 발송 비용이 거의 없어 횟수 제한을 두지 않습니다. (문자만 과금 방지로 제한)
  const code = String(Math.floor(100000 + Math.random() * 900000));
  emailOtpStore.set(email, {code, expires: Date.now() + OTP_TTL_MS});
  console.log(`📧 [학교이메일인증] ${email} 인증코드: ${code} (개발용)`);
  res.json({ok: true, devCode: code});
});

// 인증코드 확인 → 맞으면 그 회원을 "대학 인증(이메일)" 완료 처리 (관리자 승인 불필요)
app.post('/api/verify-email-otp', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '').trim();
  const userId = req.body?.userId;
  const rec = emailOtpStore.get(email);
  if (!rec) return res.status(400).json({error: '먼저 인증코드를 요청해 주세요.'});
  if (Date.now() > rec.expires) return res.status(400).json({error: '인증코드가 만료됐어요. 다시 요청해 주세요.'});
  if (rec.code !== code) return res.status(400).json({error: '인증코드가 일치하지 않아요.'});
  emailOtpStore.delete(email);
  // 로그인 회원을 모르면 실제 반영이 안 되므로 "성공"이 아니라 에러로 알립니다.
  if (!userId) return res.status(400).json({error: '로그인 정보가 없어요. 다시 로그인한 뒤 시도해 주세요.'});
  try {
    const r = await pool.query(
      `UPDATE users SET verified = TRUE, school_method = '대학교 이메일' WHERE id = $1
       RETURNING id, nickname, email, school, grad_year, region, region_city, role, verified, school_method, region_verified, hide_school_name, hide_region_name, phone, birth, status`,
      [userId],
    );
    res.json({ok: true, user: r.rows[0]});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// --- 인증 부여(관리자 승인 반영) : POST /api/set-verification ---
//  - 관리자가 인증을 승인하면 해당 회원의 DB 인증 상태를 켭니다. (대학=verified+school_method, 지역=region_verified)
app.post('/api/set-verification', async (req, res) => {
  const {userId, type, method} = req.body || {};
  if (!userId) return res.status(400).json({error: 'userId 가 필요해요.'});
  try {
    if (type === '지역') {
      await pool.query('UPDATE users SET region_verified = TRUE WHERE id = $1', [userId]);
    } else {
      await pool.query('UPDATE users SET verified = TRUE, school_method = $2 WHERE id = $1', [userId, method || null]);
    }
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// --- 인증 해제(재인증용) : POST /api/reset-verification ---
//  - 회원이 "인증 방법 변경"을 누르면 기존 인증을 초기화합니다. (대학=verified, 지역=region_verified)
app.post('/api/reset-verification', async (req, res) => {
  const userId = req.body?.userId;
  const type = req.body?.type;
  if (!userId) return res.status(400).json({error: 'userId 가 필요해요.'});
  try {
    if (type === '지역') {
      await pool.query('UPDATE users SET region_verified = FALSE WHERE id = $1', [userId]);
    } else {
      await pool.query('UPDATE users SET verified = FALSE, school_method = NULL WHERE id = $1', [userId]);
    }
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// --- 회원가입 : POST /api/signup (휴대폰 본인인증 필수) ---
app.post('/api/signup', async (req, res) => {
  const {nickname, email, password, school, gradYear, region, phone, realName, birth, address} = req.body || {};
  if (!nickname || !email || !password) return res.status(400).json({error: '필수 정보를 입력해 주세요.'});

  // 본인인증을 마친 번호인지 확인
  const ph = normPhone(phone);
  const rec = otpStore.get(ph);
  if (!ph || !rec?.verified) return res.status(400).json({error: '휴대폰 본인인증을 먼저 완료해 주세요.'});
  // 회원가입 정보(실명·생년월일)가 본인인증으로 확인된 정보와 일치하는지 확인
  const rn = String(realName || '').trim();
  const bd = String(birth || '').trim();
  if (!rn || !bd) return res.status(400).json({error: '실명과 생년월일을 입력해 주세요.'});
  if (rec.realName !== rn || rec.birth !== bd) {
    return res.status(400).json({error: '본인인증한 정보(실명·생년월일)와 일치하지 않아요.'});
  }

  try {
    const dup = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (dup.rowCount > 0) return res.status(409).json({error: '이미 가입된 이메일이에요.'});
    const dupPhone = await pool.query('SELECT 1 FROM users WHERE phone = $1', [ph]);
    if (dupPhone.rowCount > 0) return res.status(409).json({error: '이미 가입된 휴대폰 번호예요.'});

    const hash = await bcrypt.hash(password, 10); // 비밀번호 해시
    const r = await pool.query(
      `INSERT INTO users (nickname, email, password_hash, school, grad_year, region, phone, phone_verified, real_name, birth, address, role, verified, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9,$10,'회원',FALSE,'정상')
       RETURNING id, nickname, email, school, grad_year, region, region_city, role, verified, school_method, region_verified, hide_school_name, hide_region_name, phone, birth, address, status`,
      [nickname, email, hash, school || null, gradYear || null, region || null, ph, rn, bd, String(address || '').trim() || null],
    );
    otpStore.delete(ph); // 사용한 인증정보 정리
    res.json({user: r.rows[0]});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// --- 로그인 : POST /api/login ---
app.post('/api/login', async (req, res) => {
  const {email, password} = req.body || {};
  if (!email) return res.status(400).json({error: '이메일을 입력해 주세요.'});
  try {
    const r = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (r.rowCount === 0) return res.status(404).json({error: '존재하지 않는 이메일이에요.'});
    const u = r.rows[0];
    if (u.status === '정지') return res.status(403).json({error: '정지된 계정이에요.'});
    if (u.status === '탈퇴') return res.status(403).json({error: '탈퇴한 계정이에요.'});

    // 시드(샘플) 계정은 password_hash 가 'TEST_HASH' 라 비번 아무거나 통과시킵니다.
    // 실제 가입 계정은 bcrypt 로 비밀번호를 검사합니다.
    if (u.password_hash !== 'TEST_HASH') {
      const ok = await bcrypt.compare(password || '', u.password_hash || '');
      if (!ok) return res.status(401).json({error: '비밀번호가 일치하지 않아요.'});
    }

    delete u.password_hash; // 해시는 절대 내려보내지 않음
    res.json({user: u});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// --- 비밀번호 변경 : POST /api/change-password ---
//  - 모든 회원·관리자가 사용. 현재 비밀번호가 맞아야 새 비밀번호로 바꿉니다.
//  - 시드(샘플) 계정은 password_hash 가 'TEST_HASH' 라 정해진 비번이 없으므로,
//    현재 비번 확인 없이 새 비밀번호를 처음 설정할 수 있게 합니다. (관리자 비번 만들기)
app.post('/api/change-password', async (req, res) => {
  const {userId, currentPassword, newPassword} = req.body || {};
  if (!userId) return res.status(400).json({error: '로그인이 필요해요.'});
  if (!newPassword || String(newPassword).length < 4) {
    return res.status(400).json({error: '새 비밀번호는 4자 이상으로 입력해 주세요.'});
  }
  try {
    const r = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (r.rowCount === 0) return res.status(404).json({error: '회원을 찾을 수 없어요.'});
    const hash = r.rows[0].password_hash;
    // 실제 비번이 설정된 계정만 현재 비번을 확인합니다. (TEST_HASH = 아직 비번 미설정)
    if (hash !== 'TEST_HASH') {
      const ok = await bcrypt.compare(String(currentPassword || ''), hash || '');
      if (!ok) return res.status(401).json({error: '현재 비밀번호가 일치하지 않아요.'});
    }
    const newHash = await bcrypt.hash(String(newPassword), 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// 날짜를 화면에서 쓰는 'YYYY.MM.DD' 로 변환
function fmtDate(d) {
  const dt = new Date(d);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}.${mm}.${dd}`;
}

// --- 게시글 목록 : GET /api/posts?userId= ---
//  - 사진(post_images), 댓글(comments), 좋아요(post_likes/comment_likes)까지 모아 화면용 모양으로 돌려줍니다.
app.get('/api/posts', async (req, res) => {
  const userId = Number(req.query.userId) || 0;
  try {
    const posts = (
      await pool.query(
        `SELECT p.*, u.nickname AS author_nick, u.avatar_url AS author_avatar FROM posts p JOIN users u ON u.id = p.author_id ORDER BY p.created_at DESC`,
      )
    ).rows;
    const images = (await pool.query('SELECT post_id, url FROM post_images ORDER BY sort')).rows;
    const comments = (
      await pool.query(`SELECT c.*, u.nickname AS author_nick, u.avatar_url AS author_avatar FROM comments c JOIN users u ON u.id = c.author_id ORDER BY c.created_at`)
    ).rows;
    const plikes = (await pool.query('SELECT post_id, user_id FROM post_likes')).rows;
    const clikes = (await pool.query('SELECT comment_id, user_id FROM comment_likes')).rows;
    const eq = (a, b) => String(a) === String(b);

    const out = posts.map((p) => ({
      id: Number(p.id),
      boardType: p.board_type,
      title: p.title,
      body: p.body,
      // 익명 게시판 글은 (anonymous 플래그와 무관하게) 항상 작성자를 '익명'으로 표시
      author: p.anonymous || p.board_type === '익명' ? '익명' : p.author_nick,
      // 익명이면 프로필 사진도 숨김 (익명성 보호)
      authorAvatar: p.anonymous || p.board_type === '익명' ? undefined : p.author_avatar || undefined,
      anonymous: p.anonymous || p.board_type === '익명',
      // 내 글인지 (익명이라 author 로는 알 수 없으므로 서버가 작성자 id 로 판단해 알려줌)
      mine: Number(p.author_id) === userId,
      region: p.region,
      school: p.school,
      regionCity: p.region_city || undefined, // 지역별 게시판: 작성자의 거주지(시/군/구)
      likes: plikes.filter((l) => eq(l.post_id, p.id)).length,
      likedByMe: plikes.some((l) => eq(l.post_id, p.id) && Number(l.user_id) === userId),
      images: images
        .filter((im) => eq(im.post_id, p.id))
        .map((im) => (/^(https?:|\/|data:)/.test(im.url) ? im.url : `/files/${im.url}`)),
      comments: comments
        .filter((c) => eq(c.post_id, p.id))
        .map((c) => ({
          id: Number(c.id),
          // 익명 게시판 글의 댓글은 작성자를 '익명'으로 표시 (DB엔 실제 작성자 id 보관 — 신고/관리용)
          author: p.board_type === '익명' ? '익명' : c.author_nick,
          authorAvatar: p.board_type === '익명' ? undefined : c.author_avatar || undefined,
          body: c.body,
          createdAt: fmtDate(c.created_at),
          parentId: c.parent_id ? Number(c.parent_id) : undefined, // 답글이면 부모 댓글 id
          likes: clikes.filter((l) => eq(l.comment_id, c.id)).length,
          likedByMe: clikes.some((l) => eq(l.comment_id, c.id) && Number(l.user_id) === userId),
        })),
      createdAt: fmtDate(p.created_at),
    }));
    res.json({posts: out});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// --- 게시글 작성 : POST /api/posts ---  (images = 업로드된 경로 배열)
app.post('/api/posts', async (req, res) => {
  const {authorId, boardType, title, body, anonymous, school, region, regionCity, images} = req.body || {};
  if (!authorId || !title) return res.status(400).json({error: '작성자와 제목이 필요해요.'});
  try {
    const r = await pool.query(
      `INSERT INTO posts (author_id, board_type, title, body, anonymous, school, region, region_city)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [authorId, boardType || '자유', title, body || '', !!anonymous, school || null, region || null, regionCity || null],
    );
    const postId = r.rows[0].id;
    if (Array.isArray(images)) {
      for (let i = 0; i < images.length; i++) {
        await pool.query('INSERT INTO post_images (post_id, url, sort) VALUES ($1,$2,$3)', [postId, images[i], i]);
      }
    }
    res.json({ok: true, id: Number(postId)});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// --- 게시글 수정 : PUT /api/posts/:id ---
app.put('/api/posts/:id', async (req, res) => {
  const {title, body, boardType, anonymous, images} = req.body || {};
  try {
    await pool.query('UPDATE posts SET title=$2, body=$3, board_type=$4, anonymous=$5 WHERE id=$1', [
      req.params.id,
      title,
      body || '',
      boardType || '자유',
      !!anonymous,
    ]);
    if (Array.isArray(images)) {
      await pool.query('DELETE FROM post_images WHERE post_id=$1', [req.params.id]);
      for (let i = 0; i < images.length; i++) {
        await pool.query('INSERT INTO post_images (post_id, url, sort) VALUES ($1,$2,$3)', [req.params.id, images[i], i]);
      }
    }
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// --- 게시글 삭제 : DELETE /api/posts/:id ---  (연결된 사진/댓글/좋아요도 함께 삭제됨)
app.delete('/api/posts/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM posts WHERE id=$1', [req.params.id]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// --- 댓글 작성 / 삭제 ---
app.post('/api/posts/:id/comments', async (req, res) => {
  const {authorId, body, parentId} = req.body || {};
  if (!authorId || !body) return res.status(400).json({error: '작성자와 내용이 필요해요.'});
  try {
    await pool.query('INSERT INTO comments (post_id, author_id, body, parent_id) VALUES ($1,$2,$3,$4)', [
      req.params.id,
      authorId,
      body,
      parentId || null,
    ]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.delete('/api/comments/:cid', async (req, res) => {
  try {
    await pool.query('DELETE FROM comments WHERE id=$1', [req.params.cid]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// --- 좋아요 토글 (1인 1회) ---
app.post('/api/posts/:id/like', async (req, res) => {
  const {userId} = req.body || {};
  if (!userId) return res.status(400).json({error: '로그인이 필요해요.'});
  try {
    const ex = await pool.query('SELECT 1 FROM post_likes WHERE post_id=$1 AND user_id=$2', [req.params.id, userId]);
    if (ex.rowCount > 0) await pool.query('DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2', [req.params.id, userId]);
    else await pool.query('INSERT INTO post_likes (post_id, user_id) VALUES ($1,$2)', [req.params.id, userId]);
    res.json({ok: true, liked: ex.rowCount === 0});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.post('/api/comments/:cid/like', async (req, res) => {
  const {userId} = req.body || {};
  if (!userId) return res.status(400).json({error: '로그인이 필요해요.'});
  try {
    const ex = await pool.query('SELECT 1 FROM comment_likes WHERE comment_id=$1 AND user_id=$2', [req.params.cid, userId]);
    if (ex.rowCount > 0) await pool.query('DELETE FROM comment_likes WHERE comment_id=$1 AND user_id=$2', [req.params.cid, userId]);
    else await pool.query('INSERT INTO comment_likes (comment_id, user_id) VALUES ($1,$2)', [req.params.cid, userId]);
    res.json({ok: true, liked: ex.rowCount === 0});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// 시:분 (오전/오후) 표시
function fmtClock(d) {
  const dt = new Date(d);
  const h = dt.getHours();
  const label = h < 12 ? '오전' : '오후';
  const h12 = ((h + 11) % 12) + 1;
  return `${label} ${h12}:${String(dt.getMinutes()).padStart(2, '0')}`;
}

// ============================================================
// 모임 (meetups) — 멤버 / 게시판(공지) / 단체채팅 / 가입인사 / 승인신청
// ============================================================
app.get('/api/meetups', async (req, res) => {
  const userId = Number(req.query.userId) || 0;
  try {
    const meetups = (
      await pool.query(`SELECT m.*, u.nickname AS host_nick FROM meetups m LEFT JOIN users u ON u.id = m.created_by ORDER BY m.id DESC`)
    ).rows;
    const members = (await pool.query('SELECT meetup_id, user_id FROM meetup_members')).rows;
    const mposts = (
      await pool.query(`SELECT p.*, u.nickname AS author_nick FROM meetup_posts p JOIN users u ON u.id = p.author_id ORDER BY p.created_at`)
    ).rows;
    const msgs = (
      await pool.query(`SELECT g.*, u.nickname AS sender_nick, u.avatar_url FROM meetup_messages g JOIN users u ON u.id = g.sender_id ORDER BY g.created_at`)
    ).rows;
    const greets = (
      await pool.query(`SELECT g.*, u.nickname AS author_nick FROM meetup_greetings g JOIN users u ON u.id = g.author_id ORDER BY g.created_at`)
    ).rows;
    const reqs = (
      await pool.query(
        `SELECT r.*, u.nickname, u.school, u.region FROM meetup_join_requests r JOIN users u ON u.id = r.applicant_id ORDER BY r.created_at`,
      )
    ).rows;
    // 모임 게시글 투표(선택지 + 표)
    const pollOpts = (await pool.query('SELECT id, meetup_post_id, label, sort FROM meetup_poll_options ORDER BY sort, id')).rows;
    const pollVotes = (await pool.query('SELECT meetup_post_id, option_id, user_id FROM meetup_poll_votes')).rows;
    // 모임 게시글 댓글 (답글 포함)
    const mcmts = (
      await pool.query(
        `SELECT c.*, u.nickname AS author_nick, u.avatar_url AS author_avatar FROM meetup_post_comments c JOIN users u ON u.id = c.author_id ORDER BY c.created_at`,
      )
    ).rows;
    const eq = (a, b) => String(a) === String(b);
    // 게시글 id 로 그 글의 댓글 목록을 만듭니다.
    const commentsOf = (postId) =>
      mcmts
        .filter((c) => eq(c.meetup_post_id, postId))
        .map((c) => ({
          id: Number(c.id),
          author: c.author_nick,
          authorAvatar: c.author_avatar || undefined,
          body: c.body,
          createdAt: fmtDate(c.created_at),
          parentId: c.parent_id ? Number(c.parent_id) : undefined,
        }));
    // 게시글 id 로 그 글의 투표 정보를 만듭니다. (선택지별 득표수 + 내가 고른 선택지)
    const pollOf = (postId) => {
      const opts = pollOpts.filter((o) => eq(o.meetup_post_id, postId));
      if (opts.length === 0) return undefined; // 투표 없는 글
      return opts.map((o) => ({
        id: Number(o.id),
        label: o.label,
        votes: pollVotes.filter((v) => eq(v.option_id, o.id)).length,
        votedByMe: pollVotes.some((v) => eq(v.option_id, o.id) && Number(v.user_id) === userId),
      }));
    };
    const out = meetups.map((m) => {
      const mem = members.filter((x) => eq(x.meetup_id, m.id));
      return {
        id: Number(m.id),
        title: m.title,
        when: m.meet_when,
        place: m.place,
        capacity: m.capacity,
        joined: mem.length,
        joinedByMe: mem.some((x) => Number(x.user_id) === userId),
        host: m.host_nick,
        requireApproval: m.require_approval,
        joinRequests: reqs
          .filter((r) => eq(r.meetup_id, m.id))
          .map((r) => ({id: Number(r.id), applicant: r.nickname, intro: r.intro || '', school: r.school, region: r.region, createdAt: fmtDate(r.created_at)})),
        posts: mposts
          .filter((p) => eq(p.meetup_id, m.id))
          .map((p) => ({id: Number(p.id), title: p.title, body: p.body, author: p.author_nick, notice: p.notice, createdAt: fmtDate(p.created_at), poll: pollOf(p.id), comments: commentsOf(p.id)})),
        messages: msgs
          .filter((x) => eq(x.meetup_id, m.id))
          .map((x) => ({
            id: Number(x.id),
            text: x.body,
            mine: Number(x.sender_id) === userId,
            time: fmtClock(x.created_at),
            senderName: x.sender_nick,
            senderAvatar: x.avatar_url || undefined,
            image: x.image_url || undefined,
          })),
        greetings: greets
          .filter((g) => eq(g.meetup_id, m.id))
          .map((g) => ({id: Number(g.id), author: g.author_nick, body: g.body, createdAt: fmtDate(g.created_at)})),
      };
    });
    res.json({meetups: out});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// 모임 만들기 (만든 사람은 자동 참여)
app.post('/api/meetups', async (req, res) => {
  const {createdBy, title, when, place, capacity, requireApproval} = req.body || {};
  if (!createdBy || !title) return res.status(400).json({error: '모임장과 제목이 필요해요.'});
  try {
    const r = await pool.query(
      `INSERT INTO meetups (title, meet_when, place, capacity, created_by, require_approval) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [title, when || '', place || '', Number(capacity) || 1, createdBy, !!requireApproval],
    );
    await pool.query('INSERT INTO meetup_members (meetup_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [r.rows[0].id, createdBy]);
    res.json({ok: true, id: Number(r.rows[0].id)});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.put('/api/meetups/:id', async (req, res) => {
  const {title, when, place, capacity, requireApproval} = req.body || {};
  try {
    await pool.query('UPDATE meetups SET title=$2, meet_when=$3, place=$4, capacity=$5, require_approval=$6 WHERE id=$1', [
      req.params.id,
      title,
      when || '',
      place || '',
      Number(capacity) || 1,
      !!requireApproval,
    ]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.delete('/api/meetups/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM meetups WHERE id=$1', [req.params.id]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// 참가/취소 토글 (승인 안 받는 모임)
app.post('/api/meetups/:id/toggle-join', async (req, res) => {
  const {userId} = req.body || {};
  if (!userId) return res.status(400).json({error: '로그인이 필요해요.'});
  try {
    const ex = await pool.query('SELECT 1 FROM meetup_members WHERE meetup_id=$1 AND user_id=$2', [req.params.id, userId]);
    if (ex.rowCount > 0) await pool.query('DELETE FROM meetup_members WHERE meetup_id=$1 AND user_id=$2', [req.params.id, userId]);
    else await pool.query('INSERT INTO meetup_members (meetup_id, user_id) VALUES ($1,$2)', [req.params.id, userId]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// 가입 신청 / 취소 (승인제 모임)
app.post('/api/meetups/:id/request', async (req, res) => {
  const {userId, intro} = req.body || {};
  if (!userId) return res.status(400).json({error: '로그인이 필요해요.'});
  try {
    await pool.query(
      `INSERT INTO meetup_join_requests (meetup_id, applicant_id, intro) VALUES ($1,$2,$3)
       ON CONFLICT (meetup_id, applicant_id) DO UPDATE SET intro=$3, created_at=CURRENT_TIMESTAMP`,
      [req.params.id, userId, intro || ''],
    );
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.delete('/api/meetups/:id/request', async (req, res) => {
  const {userId} = req.body || {};
  try {
    await pool.query('DELETE FROM meetup_join_requests WHERE meetup_id=$1 AND applicant_id=$2', [req.params.id, userId]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
// 모임장: 승인 → 멤버 추가 + 신청 삭제 / 거절 → 신청 삭제
app.post('/api/meetups/:id/approve', async (req, res) => {
  const {reqId} = req.body || {};
  try {
    const r = await pool.query('SELECT applicant_id FROM meetup_join_requests WHERE id=$1', [reqId]);
    if (r.rowCount > 0) {
      await pool.query('INSERT INTO meetup_members (meetup_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id, r.rows[0].applicant_id]);
      await pool.query('DELETE FROM meetup_join_requests WHERE id=$1', [reqId]);
    }
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.post('/api/meetups/:id/reject', async (req, res) => {
  const {reqId} = req.body || {};
  try {
    await pool.query('DELETE FROM meetup_join_requests WHERE id=$1', [reqId]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// 모임 게시판(공지/글) 작성·삭제, 단체채팅, 가입인사
app.post('/api/meetups/:id/posts', async (req, res) => {
  const {authorId, title, body, notice, poll} = req.body || {};
  if (!authorId || !title) return res.status(400).json({error: '작성자와 제목이 필요해요.'});
  try {
    const r = await pool.query(
      'INSERT INTO meetup_posts (meetup_id, author_id, title, body, notice) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [req.params.id, authorId, title, body || '', !!notice],
    );
    // 투표 선택지가 있으면 함께 저장 (빈 값은 거르고, 2개 이상일 때만)
    const options = Array.isArray(poll) ? poll.map((s) => String(s || '').trim()).filter(Boolean) : [];
    if (options.length >= 2) {
      for (let i = 0; i < options.length; i++) {
        await pool.query('INSERT INTO meetup_poll_options (meetup_post_id, label, sort) VALUES ($1,$2,$3)', [r.rows[0].id, options[i], i]);
      }
    }
    res.json({ok: true, id: Number(r.rows[0].id)});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
// 투표하기 / 바꾸기 (한 게시글당 1인 1표 → 누르면 그 선택지로 갱신)
app.post('/api/meetup-posts/:pid/vote', async (req, res) => {
  const {userId, optionId} = req.body || {};
  if (!userId || !optionId) return res.status(400).json({error: '투표할 선택지가 필요해요.'});
  try {
    // 이미 같은 선택지에 투표했으면 취소(토글), 아니면 그 선택지로 갱신
    const cur = await pool.query('SELECT option_id FROM meetup_poll_votes WHERE meetup_post_id=$1 AND user_id=$2', [req.params.pid, userId]);
    if (cur.rowCount > 0 && String(cur.rows[0].option_id) === String(optionId)) {
      await pool.query('DELETE FROM meetup_poll_votes WHERE meetup_post_id=$1 AND user_id=$2', [req.params.pid, userId]);
    } else {
      await pool.query(
        `INSERT INTO meetup_poll_votes (meetup_post_id, option_id, user_id) VALUES ($1,$2,$3)
         ON CONFLICT (meetup_post_id, user_id) DO UPDATE SET option_id=$2`,
        [req.params.pid, optionId, userId],
      );
    }
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.delete('/api/meetup-posts/:pid', async (req, res) => {
  try {
    await pool.query('DELETE FROM meetup_posts WHERE id=$1', [req.params.pid]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
// 모임 게시글 댓글 달기 (parentId 있으면 답글)
app.post('/api/meetup-posts/:pid/comments', async (req, res) => {
  const {authorId, body, parentId} = req.body || {};
  if (!authorId || !body) return res.status(400).json({error: '작성자와 내용이 필요해요.'});
  try {
    await pool.query('INSERT INTO meetup_post_comments (meetup_post_id, author_id, body, parent_id) VALUES ($1,$2,$3,$4)', [
      req.params.pid,
      authorId,
      body,
      parentId || null,
    ]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
// 모임 게시글 댓글 삭제
app.delete('/api/meetup-post-comments/:cid', async (req, res) => {
  try {
    await pool.query('DELETE FROM meetup_post_comments WHERE id=$1', [req.params.cid]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.post('/api/meetups/:id/messages', async (req, res) => {
  const {senderId, text, image} = req.body || {};
  if (!senderId) return res.status(400).json({error: '로그인이 필요해요.'});
  try {
    await pool.query('INSERT INTO meetup_messages (meetup_id, sender_id, body, image_url) VALUES ($1,$2,$3,$4)', [
      req.params.id,
      senderId,
      text || '',
      image || null,
    ]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.post('/api/meetups/:id/greetings', async (req, res) => {
  const {authorId, body} = req.body || {};
  if (!authorId || !body) return res.status(400).json({error: '작성자와 내용이 필요해요.'});
  try {
    await pool.query('INSERT INTO meetup_greetings (meetup_id, author_id, body) VALUES ($1,$2,$3)', [req.params.id, authorId, body]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// ============================================================
// 중고거래 (market_items + item_images) — 사진은 D:\Cookie_db\transaction
// ============================================================
app.get('/api/items', async (_req, res) => {
  try {
    const items = (
      await pool.query(`SELECT i.*, u.nickname AS seller_nick FROM market_items i LEFT JOIN users u ON u.id = i.seller_id ORDER BY i.id DESC`)
    ).rows;
    const imgs = (await pool.query('SELECT item_id, url FROM item_images ORDER BY sort')).rows;
    const cmts = (
      await pool.query(
        `SELECT c.*, u.nickname AS author_nick, u.avatar_url AS author_avatar FROM item_comments c JOIN users u ON u.id = c.author_id ORDER BY c.created_at`,
      )
    ).rows;
    const eq = (a, b) => String(a) === String(b);
    const norm = (u) => (/^(https?:|\/|data:)/.test(u) ? u : `/files/${u}`);
    const out = items.map((i) => {
      const im = imgs.find((x) => eq(x.item_id, i.id));
      return {
        id: Number(i.id),
        title: i.title,
        price: i.price,
        place: i.place,
        status: i.status,
        body: i.body,
        image: im ? norm(im.url) : undefined,
        seller: i.seller_nick,
        comments: cmts
          .filter((c) => eq(c.item_id, i.id))
          .map((c) => ({
            id: Number(c.id),
            author: c.author_nick,
            authorAvatar: c.author_avatar || undefined,
            body: c.body,
            createdAt: fmtDate(c.created_at),
            parentId: c.parent_id ? Number(c.parent_id) : undefined,
          })),
      };
    });
    res.json({items: out});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.post('/api/items', async (req, res) => {
  const {sellerId, title, price, place, status, body, image} = req.body || {};
  if (!sellerId || !title) return res.status(400).json({error: '판매자와 제목이 필요해요.'});
  try {
    const r = await pool.query(
      `INSERT INTO market_items (seller_id, title, price, place, status, body) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [sellerId, title, Number(price) || 0, place || '', status || '판매중', body || ''],
    );
    if (image) await pool.query('INSERT INTO item_images (item_id, url, sort) VALUES ($1,$2,0)', [r.rows[0].id, image]);
    res.json({ok: true, id: Number(r.rows[0].id)});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.put('/api/items/:id', async (req, res) => {
  const {title, price, place, status, body, image} = req.body || {};
  try {
    await pool.query('UPDATE market_items SET title=$2, price=$3, place=$4, status=$5, body=$6 WHERE id=$1', [
      req.params.id,
      title,
      Number(price) || 0,
      place || '',
      status || '판매중',
      body || '',
    ]);
    await pool.query('DELETE FROM item_images WHERE item_id=$1', [req.params.id]);
    if (image) await pool.query('INSERT INTO item_images (item_id, url, sort) VALUES ($1,$2,0)', [req.params.id, image]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.delete('/api/items/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM market_items WHERE id=$1', [req.params.id]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
// 판매글 댓글 달기
app.post('/api/items/:id/comments', async (req, res) => {
  const {authorId, body, parentId} = req.body || {};
  if (!authorId || !body) return res.status(400).json({error: '작성자와 내용이 필요해요.'});
  try {
    await pool.query('INSERT INTO item_comments (item_id, author_id, body, parent_id) VALUES ($1,$2,$3,$4)', [
      req.params.id,
      authorId,
      body,
      parentId || null,
    ]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
// 판매글 댓글 삭제
app.delete('/api/item-comments/:cid', async (req, res) => {
  try {
    await pool.query('DELETE FROM item_comments WHERE id=$1', [req.params.cid]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// ============================================================
// 공통 도우미 / 신고 종류(한글 ↔ DB 영문) 변환표
// ============================================================
// 닉네임으로 회원 id 찾기 (없으면 null). 닉네임이 겹치면 가장 먼저 가입한 회원을 씁니다.
async function idByNick(nick) {
  if (!nick) return null;
  const r = await pool.query('SELECT id FROM users WHERE nickname=$1 ORDER BY id LIMIT 1', [String(nick)]);
  return r.rowCount > 0 ? r.rows[0].id : null;
}
// 업로드된 경로(또는 일반 URL)는 그대로, 그 외엔 /files/ 를 붙여 화면에서 볼 수 있게 합니다.
const normUrl = (u) => (/^(https?:|\/|data:)/.test(u) ? u : `/files/${u}`);
// 신고 대상 종류: 화면(한글) ↔ DB(영문 enum)
const REPORT_TYPE_TO_DB = {회원: 'user', 게시글: 'post', 댓글: 'comment', 채팅방: 'chat_room', 상품: 'market_item', 모임: 'meetup'};
const REPORT_TYPE_FROM_DB = {user: '회원', post: '게시글', comment: '댓글', chat_room: '채팅방', market_item: '상품', meetup: '모임'};

// ============================================================
// 게시판 (boards) — 학생이 만드는 게시판 목록
// ============================================================
app.get('/api/boards', async (_req, res) => {
  try {
    const rows = (await pool.query('SELECT id, name, pinned, created_at FROM boards ORDER BY created_at DESC')).rows;
    res.json({boards: rows.map((b) => ({id: Number(b.id), name: b.name, pinned: b.pinned, createdAt: fmtDate(b.created_at)}))});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.post('/api/boards', async (req, res) => {
  const {createdBy, name} = req.body || {};
  const trimmed = String(name || '').trim();
  if (!createdBy || !trimmed) return res.status(400).json({error: '게시판 이름을 입력해 주세요.'});
  try {
    const dup = await pool.query('SELECT 1 FROM boards WHERE name=$1', [trimmed]);
    if (dup.rowCount > 0) return res.status(409).json({error: '이미 있는 게시판이에요.'});
    const r = await pool.query('INSERT INTO boards (name, created_by) VALUES ($1,$2) RETURNING id', [trimmed, createdBy]);
    res.json({ok: true, id: Number(r.rows[0].id)});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.post('/api/boards/:id/pin', async (req, res) => {
  try {
    await pool.query('UPDATE boards SET pinned = NOT pinned WHERE id=$1', [req.params.id]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
// 개인 게시판 고정(즐겨찾기) — 내가 고정한 게시판 이름 목록
app.get('/api/board-favorites', async (req, res) => {
  const userId = Number(req.query.userId) || 0;
  try {
    const rows = (await pool.query('SELECT board_name FROM board_favorites WHERE user_id=$1 ORDER BY created_at', [userId])).rows;
    res.json({favorites: rows.map((r) => r.board_name)});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
// 고정 토글 (있으면 해제, 없으면 추가)
app.post('/api/board-favorites/toggle', async (req, res) => {
  const {userId, boardName} = req.body || {};
  const name = String(boardName || '').trim();
  if (!userId || !name) return res.status(400).json({error: '로그인과 게시판 이름이 필요해요.'});
  try {
    const ex = await pool.query('SELECT 1 FROM board_favorites WHERE user_id=$1 AND board_name=$2', [userId, name]);
    if (ex.rowCount > 0) {
      await pool.query('DELETE FROM board_favorites WHERE user_id=$1 AND board_name=$2', [userId, name]);
      res.json({ok: true, pinned: false});
    } else {
      await pool.query('INSERT INTO board_favorites (user_id, board_name) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, name]);
      res.json({ok: true, pinned: true});
    }
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// ============================================================
// 알림 (notifications) — 좋아요/댓글/쪽지 등이 생기면 받을 사람에게 쌓임
// ============================================================
app.get('/api/notifications', async (req, res) => {
  const userId = Number(req.query.userId) || 0;
  try {
    const rows = (
      await pool.query(
        `SELECT n.*, u.nickname AS to_nick FROM notifications n JOIN users u ON u.id=n.user_id WHERE n.user_id=$1 ORDER BY n.created_at DESC`,
        [userId],
      )
    ).rows;
    res.json({
      notifications: rows.map((n) => ({
        id: Number(n.id),
        toUser: n.to_nick,
        message: n.message,
        postId: n.post_id ? Number(n.post_id) : undefined,
        noteWith: n.note_with || undefined,
        read: n.is_read,
        createdAt: fmtDate(n.created_at),
      })),
    });
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
// 알림 만들기 (받는 사람 닉네임으로 보냄. 못 찾으면 조용히 넘어감 — 익명 등)
app.post('/api/notifications', async (req, res) => {
  const {toNick, type, message, postId, noteWith} = req.body || {};
  try {
    const toId = await idByNick(toNick);
    if (!toId) return res.json({ok: true, skipped: true});
    await pool.query('INSERT INTO notifications (user_id, type, message, post_id, note_with) VALUES ($1,$2,$3,$4,$5)', [
      toId,
      type || 'etc',
      message || '',
      postId || null,
      noteWith || null,
    ]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.post('/api/notifications/:id/read', async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read=TRUE WHERE id=$1', [req.params.id]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.post('/api/notifications/read-all', async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read=TRUE WHERE user_id=$1', [req.body?.userId]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// ============================================================
// 쪽지 (notes) — 실시간 채팅과 별개인 1:1 메모
// ============================================================
app.get('/api/notes', async (req, res) => {
  const userId = Number(req.query.userId) || 0;
  try {
    const rows = (
      await pool.query(
        `SELECT n.*, f.nickname AS from_nick, t.nickname AS to_nick
         FROM notes n JOIN users f ON f.id=n.from_id JOIN users t ON t.id=n.to_id
         WHERE n.from_id=$1 OR n.to_id=$1 ORDER BY n.created_at DESC`,
        [userId],
      )
    ).rows;
    res.json({
      notes: rows.map((n) => ({
        id: Number(n.id),
        fromName: n.from_nick,
        toName: n.to_nick,
        body: n.body,
        createdAt: fmtDate(n.created_at),
        mine: Number(n.from_id) === userId,
        read: n.is_read,
      })),
    });
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
// 쪽지 보내기 (받는 사람에게 알림도 함께 생성)
app.post('/api/notes', async (req, res) => {
  const {fromId, toName, body} = req.body || {};
  if (!fromId || !body) return res.status(400).json({error: '받는 사람과 내용이 필요해요.'});
  try {
    const toId = await idByNick(toName);
    if (!toId) return res.status(404).json({error: '받는 사람을 찾을 수 없어요.'});
    await pool.query('INSERT INTO notes (from_id, to_id, body) VALUES ($1,$2,$3)', [fromId, toId, body]);
    // 내가 나에게 보내는 게 아니면 받는 사람에게 알림
    if (Number(toId) !== Number(fromId)) {
      const fr = await pool.query('SELECT nickname FROM users WHERE id=$1', [fromId]);
      const fromNick = fr.rows[0]?.nickname || '';
      await pool.query('INSERT INTO notifications (user_id, type, message, note_with) VALUES ($1,$2,$3,$4)', [
        toId,
        'note',
        `${fromNick}님이 쪽지를 보냈어요.`,
        fromNick,
      ]);
    }
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.delete('/api/notes/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM notes WHERE id=$1', [req.params.id]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.post('/api/notes/:id/read', async (req, res) => {
  try {
    await pool.query('UPDATE notes SET is_read=TRUE WHERE id=$1', [req.params.id]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// ============================================================
// 실시간 채팅 (chat_rooms + 멤버 + 메시지)
// ============================================================
app.get('/api/rooms', async (req, res) => {
  const userId = Number(req.query.userId) || 0;
  try {
    const myRooms = (
      await pool.query(
        `SELECT r.* FROM chat_rooms r JOIN chat_room_members m ON m.room_id=r.id WHERE m.user_id=$1 ORDER BY r.id DESC`,
        [userId],
      )
    ).rows;
    const ids = myRooms.map((r) => r.id);
    if (ids.length === 0) return res.json({rooms: []});
    const members = (
      await pool.query(
        `SELECT cm.room_id, u.id, u.nickname, u.avatar_url FROM chat_room_members cm JOIN users u ON u.id=cm.user_id WHERE cm.room_id = ANY($1)`,
        [ids],
      )
    ).rows;
    const msgs = (
      await pool.query(
        `SELECT g.*, u.nickname AS sender_nick, u.avatar_url FROM chat_messages g JOIN users u ON u.id=g.sender_id WHERE g.room_id = ANY($1) ORDER BY g.created_at`,
        [ids],
      )
    ).rows;
    const eq = (a, b) => String(a) === String(b);
    res.json({
      rooms: myRooms.map((r) => ({
        id: Number(r.id),
        name: r.name,
        purpose: r.purpose || undefined,
        capacity: r.capacity || undefined,
        members: members.filter((m) => eq(m.room_id, r.id)).map((m) => ({id: Number(m.id), name: m.nickname, avatar: m.avatar_url || undefined})),
        messages: msgs
          .filter((m) => eq(m.room_id, r.id))
          .map((m) => ({
            id: Number(m.id),
            text: m.body || '',
            mine: Number(m.sender_id) === userId,
            time: fmtClock(m.created_at),
            senderName: m.sender_nick,
            senderAvatar: m.avatar_url || undefined,
            image: m.image_url || undefined,
          })),
      })),
    });
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
// 1:1 채팅방 열기 — 같은 이름의 내 방이 있으면 그 id, 없으면 새로 만들어 돌려줌
app.post('/api/rooms/direct', async (req, res) => {
  const {userId, name, partnerNick} = req.body || {};
  if (!userId || !name) return res.status(400).json({error: '로그인이 필요해요.'});
  try {
    const ex = (
      await pool.query(`SELECT r.id FROM chat_rooms r JOIN chat_room_members m ON m.room_id=r.id WHERE r.name=$1 AND m.user_id=$2 LIMIT 1`, [name, userId])
    ).rows;
    if (ex.length > 0) return res.json({ok: true, id: Number(ex[0].id)});
    const r = await pool.query('INSERT INTO chat_rooms (name) VALUES ($1) RETURNING id', [name]);
    const roomId = r.rows[0].id;
    await pool.query('INSERT INTO chat_room_members (room_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [roomId, userId]);
    const partnerId = await idByNick(partnerNick);
    if (partnerId && Number(partnerId) !== Number(userId)) {
      await pool.query('INSERT INTO chat_room_members (room_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [roomId, partnerId]);
    }
    res.json({ok: true, id: Number(roomId)});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
// 목적이 있는 채팅방 새로 만들기 (개설자가 첫 멤버) — 정원은 2~100명
app.post('/api/rooms', async (req, res) => {
  const {userId, name, purpose, capacity} = req.body || {};
  if (!userId || !name) return res.status(400).json({error: '로그인과 방 이름이 필요해요.'});
  const cap = Math.min(Math.max(Number(capacity) || 0, 2), 100);
  try {
    const r = await pool.query('INSERT INTO chat_rooms (name, purpose, capacity) VALUES ($1,$2,$3) RETURNING id', [name, purpose || null, cap]);
    const roomId = r.rows[0].id;
    await pool.query('INSERT INTO chat_room_members (room_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [roomId, userId]);
    res.json({ok: true, id: Number(roomId)});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
// 둘러보기: 목적이 있는(공개) 채팅방 목록 — 현재 인원/정원/내 참여 여부 포함
app.get('/api/rooms/open', async (req, res) => {
  const userId = Number(req.query.userId) || 0;
  try {
    const rooms = (
      await pool.query(
        `SELECT r.*,
                (SELECT COUNT(*) FROM chat_room_members m WHERE m.room_id=r.id) AS cnt,
                EXISTS(SELECT 1 FROM chat_room_members m WHERE m.room_id=r.id AND m.user_id=$1) AS joined
           FROM chat_rooms r
          WHERE r.purpose IS NOT NULL
          ORDER BY r.id DESC`,
        [userId],
      )
    ).rows;
    res.json({
      rooms: rooms.map((r) => ({
        id: Number(r.id),
        name: r.name,
        purpose: r.purpose,
        capacity: r.capacity,
        count: Number(r.cnt),
        joinedByMe: r.joined,
      })),
    });
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
// 채팅방 참여하기 (정원이 가득 차면 거절)
app.post('/api/rooms/:id/join', async (req, res) => {
  const {userId} = req.body || {};
  if (!userId) return res.status(400).json({error: '로그인이 필요해요.'});
  try {
    const room = (await pool.query('SELECT capacity FROM chat_rooms WHERE id=$1', [req.params.id])).rows[0];
    if (!room) return res.status(404).json({error: '없는 방이에요.'});
    const already = await pool.query('SELECT 1 FROM chat_room_members WHERE room_id=$1 AND user_id=$2', [req.params.id, userId]);
    if (already.rowCount > 0) return res.json({ok: true}); // 이미 참여 중이면 그대로 성공
    const cnt = Number((await pool.query('SELECT COUNT(*) AS c FROM chat_room_members WHERE room_id=$1', [req.params.id])).rows[0].c);
    if (room.capacity && cnt >= room.capacity) return res.status(409).json({error: '정원이 가득 찼어요.'});
    await pool.query('INSERT INTO chat_room_members (room_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id, userId]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.post('/api/rooms/:id/messages', async (req, res) => {
  const {senderId, text, image} = req.body || {};
  if (!senderId) return res.status(400).json({error: '로그인이 필요해요.'});
  try {
    await pool.query('INSERT INTO chat_messages (room_id, sender_id, body, image_url) VALUES ($1,$2,$3,$4)', [
      req.params.id,
      senderId,
      text || '',
      image || null,
    ]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
// 채팅방 나가기 = 내 멤버십만 삭제 (아무도 안 남으면 방도 삭제)
app.post('/api/rooms/:id/leave', async (req, res) => {
  const {userId} = req.body || {};
  try {
    await pool.query('DELETE FROM chat_room_members WHERE room_id=$1 AND user_id=$2', [req.params.id, userId]);
    const left = await pool.query('SELECT 1 FROM chat_room_members WHERE room_id=$1', [req.params.id]);
    if (left.rowCount === 0) await pool.query('DELETE FROM chat_rooms WHERE id=$1', [req.params.id]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// ============================================================
// 문의하기 (inquiries + inquiry_images) — 사진은 D:\Cookie_db\ask
// ============================================================
app.get('/api/inquiries', async (req, res) => {
  const userId = Number(req.query.userId) || 0;
  try {
    const meRow = (await pool.query('SELECT role FROM users WHERE id=$1', [userId])).rows[0];
    const isAdmin = meRow?.role === '관리자';
    const rows = (
      await pool.query(
        isAdmin
          ? `SELECT i.* FROM inquiries i ORDER BY i.created_at DESC`
          : `SELECT i.* FROM inquiries i WHERE i.user_id=$1 ORDER BY i.created_at DESC`,
        isAdmin ? [] : [userId],
      )
    ).rows;
    const imgs = (await pool.query('SELECT inquiry_id, url FROM inquiry_images ORDER BY sort')).rows;
    const eq = (a, b) => String(a) === String(b);
    res.json({
      inquiries: rows.map((i) => ({
        id: Number(i.id),
        title: i.title,
        body: i.body || '',
        answer: i.answer || undefined,
        createdAt: fmtDate(i.created_at),
        images: imgs.filter((x) => eq(x.inquiry_id, i.id)).map((x) => normUrl(x.url)),
      })),
    });
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.post('/api/inquiries', async (req, res) => {
  const {userId, title, body, images} = req.body || {};
  if (!userId || !title) return res.status(400).json({error: '제목을 입력해 주세요.'});
  try {
    const r = await pool.query('INSERT INTO inquiries (user_id, title, body) VALUES ($1,$2,$3) RETURNING id', [userId, title, body || '']);
    if (Array.isArray(images)) {
      for (let i = 0; i < images.length; i++) {
        await pool.query('INSERT INTO inquiry_images (inquiry_id, url, sort) VALUES ($1,$2,$3)', [r.rows[0].id, images[i], i]);
      }
    }
    res.json({ok: true, id: Number(r.rows[0].id)});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.delete('/api/inquiries/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM inquiries WHERE id=$1', [req.params.id]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.post('/api/inquiries/:id/answer', async (req, res) => {
  const {answer, adminId} = req.body || {};
  try {
    await pool.query('UPDATE inquiries SET answer=$2, answered_by=$3 WHERE id=$1', [req.params.id, answer || '', adminId || null]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// ============================================================
// 신고 (reports + report_images) — 사진은 D:\Cookie_db\report
// ============================================================
app.get('/api/reports', async (_req, res) => {
  try {
    const rows = (
      await pool.query(`SELECT r.*, u.nickname AS reporter_nick FROM reports r JOIN users u ON u.id=r.reporter_id ORDER BY r.created_at DESC`)
    ).rows;
    const imgs = (await pool.query('SELECT report_id, url FROM report_images ORDER BY sort')).rows;
    const eq = (a, b) => String(a) === String(b);
    res.json({
      reports: rows.map((r) => {
        const im = imgs.find((x) => eq(x.report_id, r.id));
        return {
          id: Number(r.id),
          reporterName: r.reporter_nick,
          targetType: REPORT_TYPE_FROM_DB[r.target_type] || '게시글',
          targetUser: r.target_user || undefined,
          targetId: r.target_id ? Number(r.target_id) : undefined,
          targetLabel: r.target_label || '',
          reason: r.reason || '',
          image: im ? normUrl(im.url) : undefined,
          createdAt: fmtDate(r.created_at),
          handled: r.handled,
        };
      }),
    });
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.post('/api/reports', async (req, res) => {
  const {reporterId, targetType, targetLabel, reason, targetUser, targetId, image} = req.body || {};
  if (!reporterId) return res.status(400).json({error: '로그인이 필요해요.'});
  try {
    const dbType = REPORT_TYPE_TO_DB[targetType] || 'post';
    const r = await pool.query(
      `INSERT INTO reports (reporter_id, target_type, target_id, target_user, target_label, reason) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [reporterId, dbType, targetId || null, targetUser || null, targetLabel || '', reason || ''],
    );
    if (image) await pool.query('INSERT INTO report_images (report_id, url, sort) VALUES ($1,$2,0)', [r.rows[0].id, image]);
    res.json({ok: true, id: Number(r.rows[0].id)});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.post('/api/reports/:id/handle', async (req, res) => {
  try {
    await pool.query('UPDATE reports SET handled=TRUE WHERE id=$1', [req.params.id]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// ============================================================
// 인증 요청 (verifications) — 회원이 서류 제출 → 관리자 심사 → 승인 시 배지 부여
// ============================================================
app.get('/api/verifications', async (_req, res) => {
  try {
    const rows = (
      await pool.query(
        `SELECT v.*, u.nickname AS user_nick, u.school AS user_school, u.grad_year AS user_grad,
                u.real_name AS user_real_name, u.birth AS user_birth, u.address AS user_address
         FROM verifications v JOIN users u ON u.id=v.user_id ORDER BY v.created_at DESC`,
      )
    ).rows;
    res.json({
      verifications: rows.map((v) => ({
        id: Number(v.id),
        userId: Number(v.user_id),
        userName: v.user_nick,
        type: v.type,
        method: v.method || '',
        school: v.user_school || '',
        gradYear: v.user_grad || undefined,
        // 본인인증으로 확인된 신원 (지역 인증 심사 때 주민등록증과 대조용)
        realName: v.user_real_name || undefined,
        birth: v.user_birth || undefined,
        address: v.user_address || undefined, // 가입 때 입력한 실거주지 주소 (주민등록증 주소와 대조용)
        regionCity: v.region_city || undefined,
        cert: normUrl(v.cert_url),
        status: v.status,
        rejectReason: v.reject_reason || undefined,
        createdAt: fmtDate(v.created_at),
      })),
    });
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
// 서류 제출 → 같은 종류의 '대기' 요청이 있으면 갱신, 없으면 새로 생성
app.post('/api/verifications', async (req, res) => {
  const {userId, type, method, cert, regionCity} = req.body || {};
  if (!userId || !cert) return res.status(400).json({error: '인증 서류가 필요해요.'});
  try {
    const ex = await pool.query(`SELECT id FROM verifications WHERE user_id=$1 AND type=$2 AND status='대기' LIMIT 1`, [userId, type || '대학']);
    if (ex.rowCount > 0) {
      await pool.query('UPDATE verifications SET method=$2, cert_url=$3, region_city=$4, created_at=CURRENT_TIMESTAMP WHERE id=$1', [
        ex.rows[0].id,
        method || null,
        cert,
        regionCity || null,
      ]);
    } else {
      await pool.query('INSERT INTO verifications (user_id, type, method, cert_url, region_city) VALUES ($1,$2,$3,$4,$5)', [
        userId,
        type || '대학',
        method || null,
        cert,
        regionCity || null,
      ]);
    }
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
// 관리자 승인 → 종류에 맞는 배지 부여 + 요청 '승인'
app.post('/api/verifications/:id/approve', async (req, res) => {
  try {
    const v = (await pool.query('SELECT * FROM verifications WHERE id=$1', [req.params.id])).rows[0];
    if (!v) return res.status(404).json({error: '인증 요청을 찾을 수 없어요.'});
    // 지역 승인: 배지 ON + 제출한 정확한 지역(경기도 수원시 등)을 회원 정보로 복사
    if (v.type === '지역') await pool.query('UPDATE users SET region_verified=TRUE, region_city=COALESCE($2, region_city) WHERE id=$1', [v.user_id, v.region_city]);
    else await pool.query('UPDATE users SET verified=TRUE, school_method=$2 WHERE id=$1', [v.user_id, v.method]);
    await pool.query(`UPDATE verifications SET status='승인' WHERE id=$1`, [req.params.id]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.post('/api/verifications/:id/reject', async (req, res) => {
  try {
    await pool.query(`UPDATE verifications SET status='거절', reject_reason=$2 WHERE id=$1`, [req.params.id, req.body?.reason || null]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// ============================================================
// 회원 관리 (users) — 관리자용 회원 목록/수정(정지·권한)/삭제 + 내 정보 수정
// ============================================================
app.get('/api/users', async (_req, res) => {
  try {
    const rows = (
      await pool.query(
        `SELECT id, nickname, email, school, grad_year, region, region_city, role, verified, school_method, region_verified,
                hide_school_name, hide_region_name, status, suspend_reason, suspend_period, suspend_until FROM users ORDER BY id`,
      )
    ).rows;
    res.json({
      users: rows.map((u) => ({
        id: Number(u.id),
        nickname: u.nickname,
        email: u.email,
        school: u.school || '',
        gradYear: u.grad_year || undefined,
        region: u.region || '',
        regionCity: u.region_city || undefined,
        role: u.role,
        verified: u.verified,
        schoolMethod: u.school_method || undefined,
        regionVerified: u.region_verified,
        hideSchoolName: u.hide_school_name,
        hideRegionName: u.hide_region_name,
        status: u.status,
        suspendReason: u.suspend_reason || undefined,
        suspendPeriod: u.suspend_period || undefined,
        suspendUntil: u.suspend_until ? fmtDate(u.suspend_until) : undefined,
      })),
    });
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
// 회원 수정 — 전달된 값만 골라서 바꿉니다 (정지/해제/권한/내 정보 등)
app.put('/api/users/:id', async (req, res) => {
  const u = req.body || {};
  try {
    const fields = [];
    const vals = [];
    const set = (col, val) => {
      vals.push(val);
      fields.push(`${col}=$${vals.length + 1}`);
    };
    if (u.nickname !== undefined) set('nickname', u.nickname);
    if (u.email !== undefined) set('email', u.email);
    if (u.school !== undefined) set('school', u.school);
    if (u.region !== undefined) set('region', u.region);
    if (u.avatar !== undefined) set('avatar_url', u.avatar || null);
    if (u.role !== undefined) set('role', u.role);
    if (u.status !== undefined) set('status', u.status);
    if (u.suspendReason !== undefined) set('suspend_reason', u.suspendReason || null);
    if (u.suspendPeriod !== undefined) set('suspend_period', u.suspendPeriod || null);
    // 정지 해제일(DATE)은 '2027.06.13' 처럼 점이 올 수 있어 대시로 바꿔 저장
    if (u.suspendUntil !== undefined) set('suspend_until', u.suspendUntil ? String(u.suspendUntil).replace(/\./g, '-') : null);
    if (u.verified !== undefined) set('verified', u.verified);
    if (u.regionVerified !== undefined) set('region_verified', u.regionVerified);
    if (u.regionCity !== undefined) set('region_city', u.regionCity || null);
    if (u.hideSchoolName !== undefined) set('hide_school_name', u.hideSchoolName);
    if (u.hideRegionName !== undefined) set('hide_region_name', u.hideRegionName);
    if (fields.length === 0) return res.json({ok: true});
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id=$1`, [req.params.id, ...vals]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});
app.delete('/api/users/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ok: true});
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

// --- 프론트엔드(빌드된 React) 정적 제공 ---
//  - 배포 시 `npm run build` 로 만든 dist 폴더를 이 백엔드가 함께 서빙합니다. (공개 URL 1개)
//  - 개발 중엔 vite dev 서버가 따로 뜨고 dist 가 없으므로 이 블록은 건너뜁니다.
//  - 반드시 모든 /api 라우트 "뒤"에 와야 합니다. (먼저 오면 API 가 가려짐)
const DIST_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  // SPA 대응: /api·/files 가 아닌 모든 경로는 index.html 로 보냅니다. (새로고침·딥링크에도 화면이 떠야 하므로)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/files')) return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
  console.log('🖥  프론트엔드 dist 서빙 활성화');
}

app.listen(PORT, () => {
  console.log(`✅ 백엔드 서버 실행: http://localhost:${PORT}`);
  console.log(`   저장 모드: ${USE_SUPABASE ? 'Supabase Storage(클라우드)' : `로컬 폴더 ${COOKIE_DB_DIR}`}`);
});

// 깨진 테스트 계정(backtest/proxytest) 확인·삭제용 일회성 스크립트
//  - 확인:  node scripts/cleanup_broken_users.mjs
//  - 삭제:  node scripts/cleanup_broken_users.mjs --delete
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || undefined,
  database: process.env.PGDATABASE || 'cookie_db',
});

const EMAILS = ['backtest@gmail.com', 'proxytest@gmail.com'];
const doDelete = process.argv.includes('--delete');

try {
  const sel = await pool.query(
    'SELECT id, nickname, email, school, region, role, status FROM users WHERE email = ANY($1)',
    [EMAILS],
  );
  console.log(`찾은 계정 ${sel.rowCount}개:`);
  for (const r of sel.rows) {
    console.log(`  id=${r.id} | email=${r.email} | nickname=${JSON.stringify(r.nickname)} | school=${JSON.stringify(r.school)} | region=${JSON.stringify(r.region)}`);
  }

  if (doDelete) {
    const del = await pool.query('DELETE FROM users WHERE email = ANY($1)', [EMAILS]);
    console.log(`\n삭제 완료: ${del.rowCount}개 (연결된 글/댓글 등도 함께 삭제됨)`);
  } else {
    console.log('\n(확인만 함. 실제로 지우려면 --delete 옵션을 붙여 다시 실행)');
  }
} catch (e) {
  console.error('오류:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

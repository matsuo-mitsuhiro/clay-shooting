#!/usr/bin/env node
/**
 * VRT branch に固定 fixture を投入するスクリプト
 *
 * 用途:
 *   vrt-baseline Neon branch（production からの copy-on-write）に対して
 *   db/seed/vrt-fixtures.sql を実行し、CI から VRT 用に参照できる状態にする。
 *
 * 使い方:
 *   VRT_DATABASE_URL=postgresql://... node scripts/vrt-seed.js
 *
 * 動作:
 *   - db/seed/vrt-fixtures.sql を読み込んで実行
 *   - SQL は BEGIN/COMMIT を含んでいるので 1 回の query() で送信
 *   - 失敗時は中断（fixture SQL 側で ROLLBACK されない構造のため、エラーは raise）
 *
 * セキュリティ:
 *   - VRT_DATABASE_URL は GitHub secret か手元 env で渡す。コミットしない。
 *   - production / staging には絶対に向けない。vrt-baseline branch 専用。
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const url = process.env.VRT_DATABASE_URL;
  if (!url) {
    console.error('ERROR: VRT_DATABASE_URL を設定してください');
    process.exit(1);
  }

  // 安全装置: production / staging 防止
  if (!url.includes('vrt') && !process.env.VRT_SEED_FORCE) {
    console.error('ERROR: VRT_DATABASE_URL のホスト名に "vrt" が含まれていません。');
    console.error('       vrt-baseline branch 以外を上書きするのを防ぐためです。');
    console.error('       意図的に実行する場合は VRT_SEED_FORCE=1 を設定してください。');
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, '..', 'db', 'seed', 'vrt-fixtures.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log(`→ Loading: ${sqlPath}`);

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✓ Connected to', url.replace(/:[^@]+@/, ':***@'));

  try {
    await client.query(sql);
    console.log('✓ vrt-fixtures.sql 適用完了');

    // 投入結果の確認
    const counts = await Promise.all([
      client.query('SELECT COUNT(*) c FROM tournaments'),
      client.query('SELECT COUNT(*) c FROM members'),
      client.query('SELECT COUNT(*) c FROM scores'),
      client.query('SELECT COUNT(*) c FROM registrations'),
      client.query('SELECT COUNT(*) c FROM associations'),
      client.query('SELECT COUNT(*) c FROM shooting_ranges'),
    ]);
    console.log('\n=== 投入後の件数 ===');
    console.log(`  tournaments:    ${counts[0].rows[0].c}`);
    console.log(`  members:        ${counts[1].rows[0].c}`);
    console.log(`  scores:         ${counts[2].rows[0].c}`);
    console.log(`  registrations:  ${counts[3].rows[0].c}`);
    console.log(`  associations:   ${counts[4].rows[0].c}`);
    console.log(`  shooting_ranges: ${counts[5].rows[0].c}`);
  } finally {
    await client.end();
  }
}

main().catch(e => {
  console.error('VRT seed failed:', e.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * マイグレーション自動実行スクリプト
 *
 * 使い方:
 *   DATABASE_URL_UNPOOLED=... node scripts/run-migrations.js
 *
 * 動作:
 *   1. _migrations テーブルが無ければ作成
 *   2. db/migrations/*.sql を昇順に走査
 *   3. _migrations に未記録のファイルだけを順次適用
 *   4. 各ファイルの適用は1つのトランザクションで実行（失敗時はROLLBACK）
 *   5. 適用成功したら _migrations に記録
 *
 * CI（GitHub Actions）から呼ばれることを想定:
 *   - .github/workflows/migrate-staging.yml （staging branch push時）
 *   - .github/workflows/migrate-production.yml （main push時）
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    console.error('ERROR: DATABASE_URL_UNPOOLED または DATABASE_URL を設定してください');
    process.exit(1);
  }

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✓ DB 接続成功');

    // _migrations テーブルを確実に作成
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        filename   VARCHAR(200) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 適用済リストを取得
    const { rows } = await client.query('SELECT filename FROM _migrations');
    const applied = new Set(rows.map(r => r.filename));
    console.log(`✓ 適用済マイグレーション: ${applied.size}件`);

    // マイグレーションファイル一覧
    const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // 001_..., 002_..., ... の連番ソート

    let appliedCount = 0;
    let skipCount = 0;

    for (const file of files) {
      if (applied.has(file)) {
        skipCount++;
        continue;
      }

      console.log(`→ Applying ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
          [file]
        );
        await client.query('COMMIT');
        console.log(`✓ ${file} applied`);
        appliedCount++;
      } catch (e) {
        await client.query('ROLLBACK');
        console.error(`✗ ${file} failed: ${e.message}`);
        throw e;
      }
    }

    console.log('');
    console.log(`完了: ${appliedCount}件 新規適用 / ${skipCount}件 スキップ（適用済）`);
  } finally {
    await client.end();
  }
}

main().catch(e => {
  console.error('');
  console.error('Migration failed:', e);
  process.exit(1);
});

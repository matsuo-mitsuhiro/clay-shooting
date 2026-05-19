import { test as setup } from '@playwright/test';
import path from 'path';

/**
 * Playwright setup project: 認証 storageState を準備
 *
 * 目的:
 *   VRT Phase 3（認証要画面）の screenshot 取得前に、運営管理者として 1 回だけログインし、
 *   その session cookie を保存。各 spec で使い回す（高速化 + 並列化）
 *
 * 接続先:
 *   - DATABASE_URL=$VRT_DATABASE_URL（vrt-baseline Neon branch）
 *   - 上記には db/seed/vrt-fixtures.sql で投入された tournament_admins (member_code=999999) が存在
 *
 * 平文パスワード:
 *   vrt-admin-pass-2099（vrt-fixtures.sql にも同じ bcrypt hash がコミット済）
 *   vrt-baseline branch は CI 専用で本番到達不可のため平文コミット OK
 */

const ADMIN_STATE = path.join(__dirname, '.auth', 'admin.json');

setup('運営管理者として storageState を作成', async ({ page }) => {
  await page.goto('/admin/login');

  await page.locator('input[placeholder="例: 12345"]').fill('999999');
  await page.locator('input[type="password"]').fill('vrt-admin-pass-2099');
  await page.getByRole('button', { name: 'ログイン' }).click();

  // ログイン後 /admin へリダイレクト。CI の cold start を考慮して長めの timeout
  await page.waitForURL(/\/admin($|\?|\/$)/, { timeout: 30000 });

  // session cookie が確実に書き込まれてから storageState を保存
  await page.waitForLoadState('networkidle');

  await page.context().storageState({ path: ADMIN_STATE });
});

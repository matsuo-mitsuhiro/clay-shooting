import { test, expect, type Page } from '@playwright/test';

/**
 * ビジュアル回帰テスト (VRT) Phase 3: 認証要画面
 *
 * 目的:
 *   - 運営管理者ログイン後の中核画面（/admin 大会一覧 + 大会詳細 3 タブ）の baseline 化
 *
 * 必要環境:
 *   - DATABASE_URL=$VRT_DATABASE_URL（vrt-baseline branch、tournament_admins fixture 入り）
 *   - storageState は `e2e/auth.setup.ts` が事前に作成（setup project 依存）
 *
 * 対象画面（fixture: tournament_id=1 "VRT サンプル大会"）:
 *   - /admin               大会一覧（運営管理者ビュー、VRT サンプル大会 1 件）
 *   - /admin/1?tab=members 選手管理タブ（6 名 + 空席行）
 *   - /admin/1?tab=scores  点数登録タブ（6 名 + R1 スコア）
 *   - /admin/1?tab=results 成績確認タブ（合計順位）
 *
 * 動的要素:
 *   - <footer> APP_VERSION → mask
 *   - 日付は fixture で 2099 年に固定 → 「current 大会」判定が常に true
 *
 * 残し（次フェーズ候補）:
 *   - registrations / settings / apply-settings タブ
 *   - inspection / report タブ（data 依存複雑）
 *   - /admin/players, /admin/logs, /admin/admins
 */

const FOOTER_MASK = (page: Page) => [page.locator('footer')];
const TOURNAMENT_ID = 1;

test.describe('ビジュアル回帰テスト (Phase 3: 認証要)', () => {
  test('管理者大会一覧 /admin', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByText('VRT サンプル大会')).toBeVisible();
    await expect(page).toHaveScreenshot('admin-tournaments.png', {
      mask: FOOTER_MASK(page),
      fullPage: true,
    });
  });

  test('大会詳細 選手管理タブ', async ({ page }) => {
    await page.goto(`/admin/${TOURNAMENT_ID}?tab=members`);
    await expect(page.getByText('サンプル 太郎')).toBeVisible();
    await expect(page).toHaveScreenshot('admin-members.png', {
      mask: FOOTER_MASK(page),
      fullPage: true,
    });
  });

  test('大会詳細 点数登録タブ', async ({ page }) => {
    await page.goto(`/admin/${TOURNAMENT_ID}?tab=scores`);
    await expect(page.getByText('サンプル 太郎')).toBeVisible();
    await expect(page).toHaveScreenshot('admin-scores.png', {
      mask: FOOTER_MASK(page),
      fullPage: true,
    });
  });

  test('大会詳細 成績確認タブ', async ({ page }) => {
    await page.goto(`/admin/${TOURNAMENT_ID}?tab=results`);
    await expect(page.getByText('サンプル 太郎')).toBeVisible();
    await expect(page).toHaveScreenshot('admin-results.png', {
      mask: FOOTER_MASK(page),
      fullPage: true,
    });
  });
});

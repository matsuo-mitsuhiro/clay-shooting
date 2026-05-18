import { test, expect, type Page } from '@playwright/test';

/**
 * ビジュアル回帰テスト (Visual Regression Test, VRT)
 *
 * 目的:
 * - 既存ページの見た目を screenshot で記録し、意図せぬレイアウト崩れを検知
 * - Tailwind 化や CSP 強化など、CSS に影響する変更の安全網
 *
 * 対象:
 * - DB/認証 不要で安定描画される静的ページ
 * - データ依存だが「CI ダミー DB で fetch 失敗 → エラー状態」が確定するページ
 * - 認証要・seed 必須ページは別途検討
 *
 * Baseline 管理:
 * - 初回・意図的更新は GitHub Actions workflow_dispatch から
 *     E2E (Playwright) → "Update visual baselines" を実行
 *   workflow が `--update-snapshots` で実行 → 自動 commit
 * - Windows ローカル実行時は font 差で diff が出るため CI 専用運用
 *
 * Footer マスク:
 * - APP_VERSION 表記が含まれるためバージョン更新ごとに差分が出る
 * - 全テストで <footer> 要素を mask して比較対象から除外
 */

const FOOTER_MASK = (page: Page) => [page.locator('footer')];

test.describe('ビジュアル回帰テスト', () => {
  test('管理者ログイン画面', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: '管理者ログイン' })).toBeVisible();
    await expect(page).toHaveScreenshot('admin-login.png', {
      mask: FOOTER_MASK(page),
      fullPage: true,
    });
  });

  test('パスワード再発行画面', async ({ page }) => {
    await page.goto('/admin/forgot-password');
    await expect(page.getByText('パスワードをお忘れの方')).toBeVisible();
    await expect(page).toHaveScreenshot('admin-forgot-password.png', {
      mask: FOOTER_MASK(page),
      fullPage: true,
    });
  });

  test('FAQ ページ', async ({ page }) => {
    await page.goto('/faq');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('faq.png', {
      mask: FOOTER_MASK(page),
      fullPage: true,
    });
  });

  test('お問合せページ', async ({ page }) => {
    await page.goto('/support');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('support.png', {
      mask: FOOTER_MASK(page),
      fullPage: true,
    });
  });

  // ---------------- Phase 1 拡張: 確定エラー状態のページ ----------------
  // CI ダミー DB 環境で確定描画されることが前提（DB fetch 失敗 → catch → 確定文言）
  // staging URL に対して走らせる場合は別 baseline が必要

  test('管理者新規登録ページ（token なし → 招待リンク無効エラー）', async ({ page }) => {
    // useEffect で token 空判定が走り、API も叩かず即エラー表示
    await page.goto('/admin/register');
    await expect(page.getByText('招待リンクが無効です')).toBeVisible();
    await expect(page).toHaveScreenshot('admin-register-no-token.png', {
      mask: FOOTER_MASK(page),
      fullPage: true,
    });
  });

  test('パスワードリセットページ（無効 token → エラー表示）', async ({ page }) => {
    // CI ダミー DB では neon() の接続が失敗 → frontend の .catch() で
    // 「エラーが発生しました」が表示される。staging Neon に繋がる場合は
    // 「このリンクは無効です」が表示されるため別 baseline 想定
    await page.goto('/admin/reset-password/invalid-vrt-token-for-baseline');
    await expect(page.getByText('再度リセットを申請する')).toBeVisible();
    await expect(page).toHaveScreenshot('admin-reset-password-invalid-token.png', {
      mask: FOOTER_MASK(page),
      fullPage: true,
    });
  });

  test('トップページ（大会なし状態）', async ({ page }) => {
    // CI ダミー DB では /api/tournaments が失敗 → tournaments=[] のまま loading=false
    // → 「大会が登録されていません」が表示される
    await page.goto('/');
    await expect(page.getByText('大会が登録されていません')).toBeVisible();
    await expect(page).toHaveScreenshot('top-empty.png', {
      mask: FOOTER_MASK(page),
      fullPage: true,
    });
  });
});

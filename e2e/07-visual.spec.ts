import { test, expect, type Page } from '@playwright/test';

/**
 * ビジュアル回帰テスト (Visual Regression Test, VRT)
 *
 * 目的:
 * - 既存ページの見た目を screenshot で記録し、意図せぬレイアウト崩れを検知
 * - Tailwind 化や CSP 強化など、CSS に影響する変更の安全網
 *
 * 対象:
 * - DB/認証 不要で安定描画される静的ページのみ
 * - 大会一覧・閲覧者画面・管理画面（認証要）は data 依存のため別途検討
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
    await expect(page.getByRole('heading', { name: /パスワード/ })).toBeVisible();
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
});

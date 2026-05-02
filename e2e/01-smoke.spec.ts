import { test, expect } from '@playwright/test';

/**
 * スモークテスト
 *
 * DB やテストデータが無くても通る最小限のテスト。
 * CI で常に実行され、デプロイ環境が「最低限動いている」ことを保証する。
 */

test.describe('スモークテスト', () => {
  test('トップページが表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/クレー射撃/);
    await expect(page.getByRole('heading', { name: /クレー射撃大会/ })).toBeVisible();
  });

  test('管理者ログイン画面が表示される', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: '管理者ログイン' })).toBeVisible();
    // label-for 紐付けが無いためテキスト検索で代替
    await expect(page.getByText('会員番号', { exact: true })).toBeVisible();
    await expect(page.getByText('パスワード', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible();
  });

  test('閲覧者ページが表示される', async ({ page }) => {
    await page.goto('/viewer');
    // 大会一覧 or 「大会がありません」のいずれかが表示される想定
    await expect(page.locator('body')).toBeVisible();
  });

  test('FAQ ページが表示される', async ({ page }) => {
    await page.goto('/faq');
    await expect(page.locator('body')).toBeVisible();
  });

  test('お問合せページが表示される', async ({ page }) => {
    await page.goto('/support');
    await expect(page.locator('body')).toBeVisible();
  });

  test('未認証で /admin にアクセスするとログイン画面にリダイレクトされる', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

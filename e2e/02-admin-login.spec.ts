import { test, expect } from '@playwright/test';

/**
 * 管理者ログインフロー（E2E #1）
 *
 * 前提: テスト用運営管理者アカウントが Neon staging branch に存在すること
 *   - 会員番号: E2E_ADMIN_MEMBER_CODE
 *   - パスワード: E2E_ADMIN_PASSWORD
 *
 * セットアップ手順:
 *   1. Neon staging branch で /admin/admins 画面から「e2e-test」運営管理者を作成
 *   2. GitHub Secrets に E2E_ADMIN_MEMBER_CODE / E2E_ADMIN_PASSWORD を登録
 */

const ADMIN_CODE = process.env.E2E_ADMIN_MEMBER_CODE;
const ADMIN_PASS = process.env.E2E_ADMIN_PASSWORD;

test.describe('管理者ログイン', () => {
  test.skip(!ADMIN_CODE || !ADMIN_PASS, 'E2E_ADMIN_MEMBER_CODE / E2E_ADMIN_PASSWORD が未設定');

  test('運営管理者がログインして大会一覧が表示される', async ({ page }) => {
    await page.goto('/admin/login');

    // label-for 紐付けが無いため placeholder と type 属性で input を特定
    await page.locator('input[placeholder="例: 12345"]').fill(ADMIN_CODE!);
    await page.locator('input[type="password"]').fill(ADMIN_PASS!);
    await page.getByRole('button', { name: 'ログイン' }).click();

    // ログイン後は /admin にリダイレクト
    await expect(page).toHaveURL(/\/admin($|\?|\/$)/);
    await expect(page.getByText(/大会一覧|新規大会作成/)).toBeVisible();
  });

  test('間違ったパスワードでログイン失敗', async ({ page }) => {
    await page.goto('/admin/login');

    await page.locator('input[placeholder="例: 12345"]').fill(ADMIN_CODE!);
    await page.locator('input[type="password"]').fill('wrong-password-12345');
    await page.getByRole('button', { name: 'ログイン' }).click();

    // エラーメッセージが表示される or ログイン画面に留まる
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

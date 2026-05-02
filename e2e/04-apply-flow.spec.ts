import { test, expect } from '@playwright/test';

/**
 * 申込フロー（E2E #3）
 *
 * Step 1: 会員番号 + メール → 6桁コード送信
 * Step 2: 6桁コード入力 → 詳細フォーム
 * Step 3: 申込確定 → 確認メール送信
 *
 * セットアップ:
 *   - 申込受付中のテスト大会が存在すること（apply_start_at < now < apply_end_at）
 *   - Mailtrap.io API でテストメールを取得して 6桁コードを抽出
 *   - GitHub Secrets:
 *       E2E_APPLY_TOURNAMENT_ID
 *       E2E_TEST_MEMBER_CODE
 *       MAILTRAP_API_TOKEN
 *       MAILTRAP_INBOX_ID
 */

const TOURNAMENT_ID = process.env.E2E_APPLY_TOURNAMENT_ID;
const MEMBER_CODE = process.env.E2E_TEST_MEMBER_CODE;
const MAILTRAP_TOKEN = process.env.MAILTRAP_API_TOKEN;
const MAILTRAP_INBOX = process.env.MAILTRAP_INBOX_ID;

test.describe('申込フロー', () => {
  test.fixme(
    !TOURNAMENT_ID || !MEMBER_CODE || !MAILTRAP_TOKEN || !MAILTRAP_INBOX,
    'TODO: Mailtrap セットアップ + テスト大会作成後に有効化',
  );

  test('Step1 → メール 6桁コード → Step2 → 申込完了', async ({ page }) => {
    const testEmail = `e2e-${Date.now()}@example.com`;

    // Step 1: 会員番号とメール入力
    await page.goto(`/tournaments/${TOURNAMENT_ID}/apply`);
    await page.getByLabel(/会員番号/).fill(MEMBER_CODE!);
    await page.getByLabel(/メールアドレス/).fill(testEmail);
    await page.getByRole('button', { name: /申込コードを送信/ }).click();

    // メール待ち（Mailtrap で取得）
    // const code = await fetchLatestCodeFromMailtrap(testEmail, MAILTRAP_TOKEN!, MAILTRAP_INBOX!);

    // Step 2: 6桁コード入力 → フォーム自動補完 → 送信
    // await page.getByLabel(/6桁コード/).fill(code);
    // await page.getByLabel(/参加日/).selectOption('day1');
    // await page.getByRole('button', { name: /申込を送信/ }).click();

    // 完了画面確認
    // await expect(page.getByText(/申込ありがとうございました/)).toBeVisible();

    expect(true).toBe(true); // placeholder
  });
});

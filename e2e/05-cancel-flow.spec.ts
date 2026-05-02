import { test, expect } from '@playwright/test';

/**
 * キャンセルフロー（E2E #4）
 *
 * 1. メールアドレス入力
 * 2. ワンタイムURL受信 → クリック
 * 3. キャンセル確定
 *
 * セットアップ:
 *   - 既存の申込（status='active'）があるテスト大会
 *   - Mailtrap セットアップ済
 *   - GitHub Secrets: E2E_APPLY_TOURNAMENT_ID 等（04 と共通）
 */

test.describe('キャンセルフロー', () => {
  test.fixme(true, 'TODO: 04-apply-flow と組み合わせて有効化（申込→キャンセルの順）');

  test('メール → ワンタイムURL → キャンセル完了', async ({ page }) => {
    const tournamentId = process.env.E2E_APPLY_TOURNAMENT_ID;

    await page.goto(`/tournaments/${tournamentId}/cancel`);
    // await page.getByLabel(/メールアドレス/).fill(testEmail);
    // await page.getByRole('button', { name: /キャンセルURLを送信/ }).click();

    // const url = await fetchLatestCancelUrlFromMailtrap(...);
    // await page.goto(url);
    // await page.getByRole('button', { name: /キャンセルを確定/ }).click();
    // await expect(page.getByText(/キャンセル完了/)).toBeVisible();

    expect(true).toBe(true); // placeholder
  });
});

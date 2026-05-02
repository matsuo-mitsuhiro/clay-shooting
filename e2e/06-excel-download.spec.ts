import { test, expect } from '@playwright/test';

/**
 * Excel ダウンロード（E2E #5）
 *
 * 1. 大会記録審査表Excel
 * 2. 大会報告書Excel
 *
 * セットアップ:
 *   - 完成した大会（点数登録済 + 記録審査保存済 + 大会報告保存済）
 *   - ログイン済セッション
 */

test.describe('Excel ダウンロード', () => {
  test.fixme(true, 'TODO: テスト用「完成大会」セットアップ後に有効化');

  test('記録審査表 Excel がダウンロードできる', async ({ page }) => {
    const tournamentId = process.env.E2E_REPORT_TOURNAMENT_ID;
    if (!tournamentId) test.skip();

    await page.goto(`/admin/${tournamentId}?tab=inspection`);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Excel(出力|ダウンロード)/ }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  });

  test('大会報告書 Excel がダウンロードできる', async ({ page }) => {
    const tournamentId = process.env.E2E_REPORT_TOURNAMENT_ID;
    if (!tournamentId) test.skip();

    await page.goto(`/admin/${tournamentId}?tab=report`);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /大会報告書/ }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  });
});

import { test, expect } from '@playwright/test';

/**
 * 大会作成 → 選手追加 → 点数入力 → 成績表示（E2E #2）
 *
 * このテストは多段階で DB を変更します。実行後はテストデータが残るため、
 * Neon ephemeral branch（CIで使い捨て）または事前に「テスト用」大会を
 * 作って毎回リセットする運用が必要です。
 *
 * セットアップ:
 *   - Neon ephemeral branch を使う場合: GitHub Actions で branch 作成→DB URL を環境変数で渡す
 *   - 簡易版: STAGING で「e2e-test-」プレフィックスの大会を作り、テスト後に削除
 */

test.describe('大会フロー', () => {
  test.fixme(true, 'TODO: Neon ephemeral branch セットアップ後に有効化');

  test('大会作成 → 選手追加 → 点数入力 → 成績で順位確認', async ({ page }) => {
    // 1. ログイン
    await page.goto('/admin/login');
    // ...

    // 2. 大会作成
    await page.goto('/admin');
    await page.getByRole('button', { name: /新規大会作成/ }).click();
    // ...

    // 3. 選手管理タブで選手追加
    // ...

    // 4. 点数登録タブで点数入力
    // ...

    // 5. 成績確認タブで順位表示
    // ...

    expect(true).toBe(true); // placeholder
  });
});

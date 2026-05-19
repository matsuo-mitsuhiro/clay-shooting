import { test, expect, type Page } from '@playwright/test';

/**
 * ビジュアル回帰テスト (VRT) Phase 2: data 依存ページ
 *
 * 目的:
 *   - 実 DB（vrt-baseline Neon branch）に固定 fixture を投入した状態で
 *     正常系の描画を screenshot baseline 化する
 *
 * 必要環境:
 *   - DATABASE_URL=$VRT_DATABASE_URL（vrt-baseline branch の接続文字列）
 *   - fixture は db/seed/vrt-fixtures.sql で投入済（tournament_id=1 固定）
 *   - CI では .github/workflows/e2e.yml の `e2e-data` ジョブが該当
 *
 * 対象画面（fixture: tournament_id=1 "VRT サンプル大会"）:
 *   - / 大会一覧（通常表示、1 件）
 *   - /viewer/1 閲覧者画面（6 名の成績）
 *   - /tournaments/1/apply 申込ページ（正常系）
 *
 * Baseline 管理:
 *   - 既存 Phase 1（07-visual.spec.ts）と同じ workflow_dispatch + update_snapshots で更新
 *   - snapshot は e2e/08-visual-data.spec.ts-snapshots/ に保存される
 *
 * 動的要素:
 *   - <footer> APP_VERSION → mask
 *   - viewer/apply の 30 秒自動リフレッシュ → screenshot は数秒で完了するため初回 fetch のみで描画される
 *   - 日付は fixture で 2099 年に固定 → 「current 大会」「申込期間内」が常に true
 */

const FOOTER_MASK = (page: Page) => [page.locator('footer')];
const TOURNAMENT_ID = 1;

test.describe('ビジュアル回帰テスト (Phase 2: data 依存)', () => {
  test('トップページ（大会一覧、通常表示）', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('VRT サンプル大会')).toBeVisible();
    await expect(page).toHaveScreenshot('top-with-tournaments.png', {
      mask: FOOTER_MASK(page),
      fullPage: true,
    });
  });

  test('閲覧者画面（成績表示）', async ({ page }) => {
    await page.goto(`/viewer/${TOURNAMENT_ID}`);
    await expect(page.getByText('サンプル 太郎')).toBeVisible();
    await expect(page).toHaveScreenshot('viewer.png', {
      mask: FOOTER_MASK(page),
      fullPage: true,
    });
  });

  test('申込ページ（正常系）', async ({ page }) => {
    await page.goto(`/tournaments/${TOURNAMENT_ID}/apply`);
    await expect(page.getByText('VRT サンプル大会')).toBeVisible();
    await expect(page).toHaveScreenshot('tournament-apply.png', {
      mask: FOOTER_MASK(page),
      fullPage: true,
    });
  });
});

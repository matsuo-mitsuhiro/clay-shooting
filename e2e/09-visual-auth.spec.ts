import { test, expect, type Page } from '@playwright/test';

/**
 * ビジュアル回帰テスト (VRT) Phase 3: 認証要画面
 *
 * 目的:
 *   - 運営管理者ログイン後の中核画面（/admin 大会一覧 + 大会詳細タブ群 + マスター画面）の baseline 化
 *
 * 必要環境:
 *   - DATABASE_URL=$VRT_DATABASE_URL（vrt-baseline branch、tournament_admins fixture 入り）
 *   - storageState は `e2e/auth.setup.ts` が事前に作成（setup project 依存）
 *
 * 対象画面（fixture: tournament_id=1 "VRT サンプル大会"）:
 *   - /admin                       大会一覧（運営管理者ビュー、VRT サンプル大会 1 件）
 *   - /admin/1?tab=members         選手管理タブ（6 名 + 空席行）
 *   - /admin/1?tab=scores          点数登録タブ（6 名 + R1 スコア）
 *   - /admin/1?tab=results         成績確認タブ（合計順位）
 *   - /admin/1?tab=registrations   申込管理タブ（申込 2 件）
 *   - /admin/1?tab=settings        大会設定タブ（大会情報 + QR + 危険ゾーン）
 *   - /admin/1?tab=apply-settings  申込設定タブ（募集人数・日時・スケジュール）
 *   - /admin/players               選手マスター（VRT 所属 7 名）
 *   - /admin/1?tab=inspection      記録審査タブ（v3.96 〜、空フォーム + ルール選択）
 *   - /admin/1?tab=report          大会報告タブ（v3.96 〜、tournament_reports + 奨励金 2 件）
 *   - /admin/logs (select filter)  操作ログ（v3.96 〜、spec 内 select で score_save filter 適用 → 動的 login 除外）
 *
 * 動的要素:
 *   - <footer> APP_VERSION → mask
 *   - 日付は fixture で 2099 年に固定 → 「current 大会」判定が常に true
 *   - 「最終保存」表示は info_saved_at / apply_saved_at が NULL のため非表示
 *   - /admin/logs は spec 内で「操作種別」select に score_save を入力して setup project が積む動的 login record を除外する設計（URL ?action= は未実装）
 *
 * 残し（次フェーズ候補）:
 *   - /admin/logs 全件表示（filter なし）— 動的 login record のため別アプローチ要
 *   - /admin/admins, /admin/associations, /admin/shooting-ranges（system-admin 専用）
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

  test('大会詳細 申込管理タブ', async ({ page }) => {
    await page.goto(`/admin/${TOURNAMENT_ID}?tab=registrations`);
    // 申込 fixture の 1 件「サンプル 七郎」で安定表示を保証
    await expect(page.getByText('サンプル 七郎')).toBeVisible();
    await expect(page).toHaveScreenshot('admin-registrations.png', {
      mask: FOOTER_MASK(page),
      fullPage: true,
    });
  });

  test('大会詳細 大会設定タブ', async ({ page }) => {
    await page.goto(`/admin/${TOURNAMENT_ID}?tab=settings`);
    // 大会名フィールドに fixture の名前が入っていることで描画完了を担保
    await expect(page.getByText('QRコード確認')).toBeVisible();
    await expect(page).toHaveScreenshot('admin-settings.png', {
      mask: FOOTER_MASK(page),
      fullPage: true,
    });
  });

  test('大会詳細 申込設定タブ', async ({ page }) => {
    await page.goto(`/admin/${TOURNAMENT_ID}?tab=apply-settings`);
    await expect(page.getByText('申込設定を保存')).toBeVisible();
    await expect(page).toHaveScreenshot('admin-apply-settings.png', {
      mask: FOOTER_MASK(page),
      fullPage: true,
    });
  });

  test('選手マスター /admin/players', async ({ page }) => {
    await page.goto('/admin/players');
    // 運営管理者は自所属 (VRT) で自動検索 → player_master 7 名が表示される
    await expect(page.getByText('サンプル 太郎')).toBeVisible();
    await expect(page).toHaveScreenshot('admin-players.png', {
      mask: FOOTER_MASK(page),
      fullPage: true,
    });
  });

  test('大会詳細 記録審査タブ', async ({ page }) => {
    await page.goto(`/admin/${TOURNAMENT_ID}?tab=inspection`);
    // ルール選択セクションがフォームの最上部 → 描画完了の指標
    await expect(page.getByText('ルール設定')).toBeVisible();
    await expect(page).toHaveScreenshot('admin-inspection.png', {
      mask: FOOTER_MASK(page),
      fullPage: true,
    });
  });

  test('大会詳細 大会報告タブ', async ({ page }) => {
    await page.goto(`/admin/${TOURNAMENT_ID}?tab=report`);
    // 基本情報セクション + fixture 投入済の備考テキストで描画完了を保証
    await expect(page.getByText('基本情報')).toBeVisible();
    await expect(page.getByText('VRT サンプル大会の備考')).toBeVisible();
    await expect(page).toHaveScreenshot('admin-report.png', {
      mask: FOOTER_MASK(page),
      fullPage: true,
    });
  });

  test('操作ログ /admin/logs (score_save filter)', async ({ page }) => {
    await page.goto('/admin/logs');
    // 「操作種別」select で「点数登録」を選択 → setup project の動的 login record を除外
    // 注: ラベルは <span> 実装で <label> 紐付けがないため locator で直接指定
    // 運営管理者は所属協会 select が非表示なので select は 1 個のみ → .first() で確定
    await page.locator('select').first().selectOption('score_save');
    // 詳細セル（固定文字列）で再 fetch 後の行描画完了を保証
    await expect(page.getByText('サンプル 太郎 25', { exact: false })).toBeVisible();
    // login record が画面から消えたことで filter が効いていることを保証
    await expect(page.getByText('運営管理者ログイン')).toHaveCount(0);
    await expect(page).toHaveScreenshot('admin-logs-score-save.png', {
      // 日時セル（td:nth-child(1)）は fixture 固定値だが念のため mask
      mask: [page.locator('footer'), page.locator('tbody td:nth-child(1)')],
      fullPage: true,
    });
  });
});

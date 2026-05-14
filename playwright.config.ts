import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E テスト設定
 *
 * 実行方法:
 *   - ローカル（Next.js dev サーバー自動起動）:
 *       npm run test:e2e
 *   - staging 環境に対して実行:
 *       E2E_BASE_URL=https://clay-shooting-stg.vercel.app npm run test:e2e
 *   - UI モード（デバッグ向け）:
 *       npm run test:e2e:ui
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html']] : 'html',

  expect: {
    // ビジュアル回帰テスト（toHaveScreenshot）のデフォルト設定
    // OS 間のフォントレンダリング差を許容するため、わずかな差分を許容
    // 大きな変更（レイアウト崩れ等）は閾値を超えて検出される
    toHaveScreenshot: {
      maxDiffPixels: 200,
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
      caret: 'hide',
    },
  },

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // モバイルテストは個別に有効化したい時だけ追加
    // {
    //   name: 'mobile-chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],

  // ローカル実行時のみ Next.js dev サーバーを自動起動
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});

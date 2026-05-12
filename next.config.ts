import type { NextConfig } from "next";

// CSP Report-Only ポリシー（v3.85〜）
// 段階導入: 違反報告だけ集める → 後続バージョンで nonce 化＋強制モードへ移行
// Next.js は inline script/style と eval を多用するため、現状は両方許可
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "report-uri /api/csp-report",
].join('; ');

// 全ページ共通の defense-in-depth セキュリティヘッダ
// HSTS は Vercel が既に付与済み。COEP は副作用が大きいので保留。
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY },
];

const nextConfig: NextConfig = {
  experimental: {
    mcpServer: false,
  },
  serverExternalPackages: ['exceljs'],
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
    ];
  },
};

export default nextConfig;

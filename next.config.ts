import type { NextConfig } from "next";

// CSP は per-request nonce が必要なため middleware.ts で動的設定（v3.89〜）
// ここでは CSP 以外の defense-in-depth セキュリティヘッダのみ設定する。
// HSTS は Vercel が既に付与済み。COEP は副作用が大きいので保留。
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
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

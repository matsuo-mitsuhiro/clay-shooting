import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// CSP nonce + strict-dynamic を Report-Only で配信（v3.89〜、D-1b Phase 2 step A）
// strict-dynamic と nonce を組み合わせ、Next.js 内部の inline script は
// x-nonce request header から自動的に nonce 属性が付与される。
// style-src は既存の `style={{}}` 1686 件があるため 'unsafe-inline' を維持。
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
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
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // per-request nonce 生成（Edge Runtime セーフ）
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  // /admin/* は認証必須（公開ページは除外）
  if (pathname.startsWith('/admin')) {
    const publicAdminPaths = ['/admin/login', '/admin/register', '/admin/forgot-password'];
    const isPublic =
      publicAdminPaths.some(p => pathname === p) ||
      pathname.startsWith('/admin/reset-password');

    if (!isPublic) {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
      });
      if (!token) {
        const loginUrl = new URL('/admin/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        const redirect = NextResponse.redirect(loginUrl);
        redirect.headers.set('Content-Security-Policy-Report-Only', csp);
        return redirect;
      }
    }
  }

  // Next.js が内部の inline script に nonce 属性を自動付与するためには、
  // request headers に `x-nonce` と `Content-Security-Policy` の両方が必要
  // （Next.js 公式パターン: https://nextjs.org/docs/app/guides/content-security-policy）
  // レスポンス側は Report-Only モード維持。
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set('Content-Security-Policy-Report-Only', csp);
  return response;
}

export const config = {
  // 全ページ対象だが、静的アセット・画像最適化・favicon は除外（パフォーマンス・nonce 不要）
  // /api/csp-report は CSP ヘッダ不要だが、middleware から外す影響は軽微
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};

import { NextRequest, NextResponse } from 'next/server';

// CSP 違反レポートの受信エンドポイント（v3.85〜）
// ブラウザは Content-Security-Policy-Report-Only の `report-uri` に対し
// `application/csp-report` または `application/json` で POST する
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const report = body['csp-report'] ?? body;
    console.warn('[CSP-REPORT]', JSON.stringify({
      blockedUri: report['blocked-uri'],
      violatedDirective: report['violated-directive'] ?? report['effective-directive'],
      documentUri: report['document-uri'],
      sourceFile: report['source-file'],
      lineNumber: report['line-number'],
    }));
  } catch {
    // パース失敗時は静かに無視（不正リクエスト対策）
  }
  return new NextResponse(null, { status: 204 });
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

function getDb() {
  return neon(process.env.DATABASE_URL!);
}

// POST: 招待トークン発行
export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const isSystem = session.user.role === 'system';
  const affiliation = session.user.affiliation ?? null;
  const memberCode = session.user.member_code ?? null;

  const sql = getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24時間後

  await sql`
    INSERT INTO admin_invitations (token, created_by, affiliation, expires_at)
    VALUES (${token}, ${isSystem ? null : memberCode}, ${affiliation}, ${expiresAt.toISOString()})
  `;

  return NextResponse.json({ success: true, token });
}

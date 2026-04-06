import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

function getDb() {
  return neon(process.env.DATABASE_URL!);
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
    CredentialsProvider({
      id: 'tournament-admin',
      name: '運営管理者',
      credentials: {
        member_code: { label: '会員番号', type: 'text' },
        password: { label: 'パスワード', type: 'password' },
        userAgent: { label: 'UA', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.member_code || !credentials?.password) return null;
        const sql = getDb();

        const rows = await sql`
          SELECT id, member_code, name, email, password_hash
          FROM tournament_admins
          WHERE member_code = ${credentials.member_code} AND is_active = true
        `;
        if (rows.length === 0) return null;

        const admin = rows[0];
        const valid = await bcrypt.compare(credentials.password, admin.password_hash as string);
        if (!valid) return null;

        // 現在の所属を player_master から取得
        const playerRows = await sql`
          SELECT affiliation FROM player_master WHERE member_code = ${credentials.member_code}
        `;
        const affiliation = playerRows.length > 0
          ? (playerRows[0].affiliation as string | null)
          : null;

        // ログイン履歴記録
        try {
          await sql`
            INSERT INTO admin_logs (admin_type, name, affiliation, email, user_agent)
            VALUES ('tournament', ${admin.name as string}, ${affiliation},
                    ${admin.email as string}, ${credentials.userAgent ?? null})
          `;
        } catch { /* ignore */ }

        return {
          id: String(admin.id),
          name: admin.name as string,
          email: admin.email as string,
          role: 'tournament' as const,
          affiliation,
          member_code: admin.member_code as string,
        };
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const allowed = (process.env.SYSTEM_ADMIN_EMAILS ?? '')
          .split(',')
          .map(e => e.trim())
          .filter(Boolean);
        if (!allowed.includes(user.email ?? '')) return false;

        // ログイン履歴記録
        try {
          const sql = getDb();
          await sql`
            INSERT INTO admin_logs (admin_type, name, affiliation, email)
            VALUES ('system', ${user.name ?? ''}, null, ${user.email ?? ''})
          `;
        } catch { /* ignore */ }
      }
      return true;
    },

    async jwt({ token, user, account }) {
      if (user) {
        token.role = ((user as { role?: string }).role ?? 'system') as 'system' | 'tournament';
        token.affiliation = (user as { affiliation?: string | null }).affiliation ?? null;
        token.member_code = (user as { member_code?: string | null }).member_code ?? null;
      }
      if (account?.provider === 'google') {
        token.role = 'system';
        token.affiliation = null;
        token.member_code = null;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.role = (token.role as 'system' | 'tournament') ?? 'system';
      session.user.affiliation = (token.affiliation as string | null) ?? null;
      session.user.member_code = (token.member_code as string | null) ?? null;
      return session;
    },
  },

  pages: {
    signIn: '/admin/login',
    error: '/admin/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 1日
  },

  secret: process.env.NEXTAUTH_SECRET,
};

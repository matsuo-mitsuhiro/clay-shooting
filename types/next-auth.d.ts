import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: 'system' | 'tournament';
      affiliation: string | null;
      member_code: string | null;
    };
  }
  interface User {
    role?: 'system' | 'tournament';
    affiliation?: string | null;
    member_code?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: 'system' | 'tournament';
    affiliation?: string | null;
    member_code?: string | null;
  }
}

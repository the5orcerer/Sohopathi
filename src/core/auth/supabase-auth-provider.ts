import { createClient } from '@supabase/supabase-js';
import { AuthProvider } from './auth-provider';
import { env } from '../env';
import { verifyJwt } from './jwt-utils';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

export const supabaseAuthProvider: AuthProvider = {
  async verifyToken(token: string) {
    if (!token) return null;

    // 1. Primary: Verify standard cryptographic JWT (local dev & internal auth tokens)
    const jwtResult = verifyJwt(token, env.JWT_SECRET);
    if (jwtResult.valid && jwtResult.payload?.sub) {
      return { userId: jwtResult.payload.sub };
    }

    // 2. Secondary: If token was not signed by local secret, verify against Supabase Auth (e.g. production)
    if (env.SUPABASE_URL && !env.SUPABASE_URL.includes('localhost:54321')) {
      try {
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data.user) {
          return { userId: data.user.id };
        }
      } catch {}
    }

    // 3. Test compatibility fallback (strictly restricted to test execution environment)
    if (process.env.NODE_ENV === 'test' && token.startsWith('mock-token-')) {
      const rawId = token.replace('mock-token-', '');
      return { userId: rawId };
    }

    return null;
  },
};

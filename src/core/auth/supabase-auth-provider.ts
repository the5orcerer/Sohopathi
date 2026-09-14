import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AuthProvider } from './auth-provider';
import { env } from '../env';
import { verifyJwt } from './jwt-utils';

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  // If URL or key is missing or is dummy/local fallback, skip Supabase instantiation
  if (!url || !key || url.includes('localhost:54321')) {
    return null;
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return null;
  }

  try {
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return supabaseClient;
  } catch {
    return null;
  }
}

export const supabaseAuthProvider: AuthProvider = {
  async verifyToken(token: string) {
    if (!token) return null;

    // 1. Primary: Verify standard cryptographic JWT (local dev & internal auth tokens)
    const jwtResult = verifyJwt(token, env.JWT_SECRET);
    if (jwtResult.valid && jwtResult.payload?.sub) {
      return { userId: jwtResult.payload.sub };
    }

    // 2. Secondary: If token was not signed by local secret, verify against Supabase Auth (e.g. production)
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client.auth.getUser(token);
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

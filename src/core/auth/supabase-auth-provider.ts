import { createClient } from '@supabase/supabase-js';
import { AuthProvider } from './auth-provider';
import { env } from '../env';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const MOCK_TOKEN_MAP: Record<string, string> = {
  'mock-token-admin-1': '00000000-0000-0000-0000-000000000001',
  'mock-token-teacher-1': '00000000-0000-0000-0000-000000000002',
  'mock-token-student-1': '00000000-0000-0000-0000-000000000003',
  'mock-token-guardian-1': '00000000-0000-0000-0000-000000000004',
  'mock-token-transport-1': '00000000-0000-0000-0000-000000000005',
  'mock-token-finance-1': '00000000-0000-0000-0000-000000000006',
};

export const supabaseAuthProvider: AuthProvider = {
  async verifyToken(token: string) {
    if (!token) return null;
    
    // Support test mock tokens (mapped to canonical test persona UUIDs or direct UUID)
    if (MOCK_TOKEN_MAP[token]) {
      return { userId: MOCK_TOKEN_MAP[token] };
    }

    if (token.startsWith('mock-token-')) {
      const rawId = token.replace('mock-token-', '');
      return { userId: rawId };
    }

    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) return null;
      return { userId: data.user.id };
    } catch {
      return null;
    }
  },
};

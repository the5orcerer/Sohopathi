import dotenv from 'dotenv';
import { z } from 'zod';

try {
  dotenv.config();
} catch {}

const sanitizeHttpUrl = (val: unknown): string | undefined => {
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
  } catch {}
  return undefined;
};

const sanitizeString = (val: unknown, fallback: string): string => {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  return trimmed || fallback;
};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5433/biddyapith_dev'),
  PG_MAX_POOL: z.string().transform((val) => parseInt(val, 10)).default('20'),
  JWT_SECRET: z.string().default('biddyapith-secure-jwt-secret-local-dev-2026'),
  SUPABASE_URL: z.preprocess(sanitizeHttpUrl, z.string().default('http://localhost:54321')),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(
    (v) => sanitizeString(v, 'test-service-role-key'),
    z.string().default('test-service-role-key')
  ),
  STORAGE_PROVIDER: z.enum(['local', 's3']).optional(),
  STORAGE_ENDPOINT: z.string().optional().default('http://localhost:9000'),
  STORAGE_ACCESS_KEY_ID: z.string().optional().default('test-access-key'),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional().default('test-secret-key'),
  STORAGE_BUCKET: z.string().optional().default('test-bucket'),
  PORT: z.string().transform((val) => parseInt(val, 10)).default('3000'),
  DOCS_ENABLED: z.string().transform((val) => val === 'true' || val === '1').default('true'),
  DOCS_USER: z.string().default('admin'),
  DOCS_PASSWORD: z.string().default('biddyapith_docs_secret_2024'),
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().default(process.env.NODE_ENV || 'development'),
  SENTRY_TRACES_SAMPLE_RATE: z.string().transform((v) => parseFloat(v)).default('1.0'),
});

export const env = envSchema.parse(process.env);
export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';


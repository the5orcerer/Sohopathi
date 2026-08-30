import dotenv from 'dotenv';
import { z } from 'zod';

try {
  dotenv.config();
} catch {}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5433/education_platform'),
  SUPABASE_URL: z.string().default('http://localhost:54321'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default('test-service-role-key'),
  STORAGE_PROVIDER: z.enum(['local', 's3']).optional(),
  STORAGE_ENDPOINT: z.string().optional().default('http://localhost:9000'),
  STORAGE_ACCESS_KEY_ID: z.string().optional().default('test-access-key'),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional().default('test-secret-key'),
  STORAGE_BUCKET: z.string().optional().default('test-bucket'),
  PORT: z.string().transform((val) => parseInt(val, 10)).default('3000'),
  DOCS_ENABLED: z.string().transform((val) => val === 'true' || val === '1').default('true'),
  DOCS_USER: z.string().default('admin'),
  DOCS_PASSWORD: z.string().default('sohopathi_docs_secret_2024'),
});

export const env = envSchema.parse(process.env);
export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';


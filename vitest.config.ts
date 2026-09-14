import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';

dotenv.config();

// Use dedicated test database or configured database when local container is unavailable
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:5433/biddyapith_dev';
process.env.JWT_SECRET = 'biddyapith-secure-jwt-secret-local-dev-2026';
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.STORAGE_PROVIDER = 's3';
process.env.STORAGE_ENDPOINT = 'http://127.0.0.1:9000';
process.env.STORAGE_ACCESS_KEY_ID = 'minioadmin';
process.env.STORAGE_SECRET_ACCESS_KEY = 'minioadmin';
process.env.STORAGE_BUCKET = 'biddyapith-local';
process.env.DOCS_ENABLED = 'true';
process.env.DOCS_USER = 'admin';
process.env.DOCS_PASSWORD = 'biddyapith_docs_secret_2024';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    maxConcurrency: 1,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
});


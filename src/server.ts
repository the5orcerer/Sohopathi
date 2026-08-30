import './instrument';
import { bootApp } from './app';
import { env } from './core/env';
import { logger } from './core/logger';
import { getStorageAdapter, s3StorageAdapter } from './core/storage';

async function main() {
  const app = await bootApp();

  let dbProvider = 'Local PostgreSQL';
  if (env.DATABASE_URL.includes('aivencloud.com')) {
    dbProvider = 'Aiven Cloud Postgres';
  } else if (env.DATABASE_URL.includes('supabase.co') || env.DATABASE_URL.includes('pooler.supabase.com')) {
    dbProvider = 'Supabase Cloud Postgres';
  } else if (env.DATABASE_URL.includes('neon.tech')) {
    dbProvider = 'Neon Cloud Postgres';
  } else if (env.DATABASE_URL.includes('sslmode=require')) {
    dbProvider = 'Remote Cloud PostgreSQL';
  }

  const isCloudStorage = getStorageAdapter() === s3StorageAdapter;

  app.listen(env.PORT, () => {
    logger.info(`--------------------------------------------------`);
    logger.info(`⚡ Server running on http://localhost:${env.PORT}`);
    logger.info(`📦 Environment:     ${env.NODE_ENV}`);
    logger.info(`🗄️  Database:        ${dbProvider}`);
    logger.info(`☁️  Storage:         ${isCloudStorage ? `Cloudflare R2 (Bucket: ${env.STORAGE_BUCKET})` : 'Local Filesystem (./uploads)'}`);
    logger.info(`🔐 Auth:            Supabase Auth (${env.SUPABASE_URL})`);
    logger.info(`--------------------------------------------------`);
  });
}

if (require.main === module) {
  main().catch((err) => {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  });
}

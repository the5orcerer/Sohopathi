import { StorageAdapter } from './storage-adapter';
import { s3StorageAdapter } from './s3-storage-adapter';
import { localStorageAdapter } from './local-storage-adapter';
import { env } from '../env';

export * from './storage-adapter';
export * from './build-key';
export * from './local-storage-adapter';
export * from './s3-storage-adapter';

/**
 * Returns the active storage adapter:
 * - When STORAGE_PROVIDER is 's3' or when production credentials exist, uses Cloudflare R2 / AWS S3.
 * - Otherwise defaults to local disk storage in `./uploads` for simple local development.
 */
export function getStorageAdapter(): StorageAdapter {
  if (env.STORAGE_PROVIDER === 'local') {
    return localStorageAdapter;
  }
  if (
    env.STORAGE_PROVIDER === 's3' ||
    (env.STORAGE_ACCESS_KEY_ID && env.STORAGE_ACCESS_KEY_ID !== 'test-access-key' && env.STORAGE_ACCESS_KEY_ID !== 'local-access-key')
  ) {
    return s3StorageAdapter;
  }
  return localStorageAdapter;
}

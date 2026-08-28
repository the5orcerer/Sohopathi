import fs from 'fs';
import path from 'path';
import { StorageAdapter } from './storage-adapter';
import { env } from '../env';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Local filesystem storage adapter for development and testing.
 * Files are saved to the local `./uploads` directory.
 * When deploying to production with Supabase/R2/S3, switch `STORAGE_PROVIDER=s3` in .env.
 */
export const localStorageAdapter: StorageAdapter = {
  async getSignedUploadUrl(key: string, contentType: string, ttlSeconds = 300): Promise<string> {
    const filePath = path.join(UPLOADS_DIR, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Return a direct upload URL pointing to the local server
    return `/api/storage/local-upload?key=${encodeURIComponent(key)}&contentType=${encodeURIComponent(contentType)}&expires=${Date.now() + ttlSeconds * 1000}`;
  },

  async getSignedDownloadUrl(key: string, ttlSeconds = 300): Promise<string> {
    // Return the static asset URL served by Express
    return `/storage-uploads/${key}`;
  },

  async deleteObject(key: string): Promise<void> {
    const filePath = path.join(UPLOADS_DIR, key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  },
};

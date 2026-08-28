import fs from 'fs';
import path from 'path';
import { StorageAdapter } from './storage-adapter';
import { env } from '../env';

function getUploadsDir(): string {
  try {
    const dir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  } catch {
    const fallback = path.join('/tmp', 'uploads');
    try {
      if (!fs.existsSync(fallback)) {
        fs.mkdirSync(fallback, { recursive: true });
      }
    } catch {}
    return fallback;
  }
}

/**
 * Local filesystem storage adapter for development and testing.
 * Files are saved to the local `./uploads` directory.
 * When deploying to production with Supabase/R2/S3, switch `STORAGE_PROVIDER=s3` in .env.
 */
export const localStorageAdapter: StorageAdapter = {
  async getSignedUploadUrl(key: string, contentType: string, ttlSeconds = 300): Promise<string> {
    const uploadsDir = getUploadsDir();
    const filePath = path.join(uploadsDir, key);
    const dir = path.dirname(filePath);
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch {}
    // Return a direct upload URL pointing to the local server
    return `/api/storage/local-upload?key=${encodeURIComponent(key)}&contentType=${encodeURIComponent(contentType)}&expires=${Date.now() + ttlSeconds * 1000}`;
  },

  async getSignedDownloadUrl(key: string, ttlSeconds = 300): Promise<string> {
    // Return the static asset URL served by Express
    return `/storage-uploads/${key}`;
  },

  async deleteObject(key: string): Promise<void> {
    const uploadsDir = getUploadsDir();
    const filePath = path.join(uploadsDir, key);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {}
  },
};

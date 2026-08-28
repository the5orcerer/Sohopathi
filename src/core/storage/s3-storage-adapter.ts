import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageAdapter } from './storage-adapter';
import { env } from '../env';

const client = new S3Client({
  region: 'auto',
  endpoint: env.STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
  },
});

const BUCKET = env.STORAGE_BUCKET;

export const s3StorageAdapter: StorageAdapter = {
  async getSignedUploadUrl(key: string, contentType: string, ttlSeconds = 300): Promise<string> {
    const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
    return getSignedUrl(client, cmd, { expiresIn: ttlSeconds });
  },

  async getSignedDownloadUrl(key: string, ttlSeconds = 300): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return getSignedUrl(client, cmd, { expiresIn: ttlSeconds });
  },

  async deleteObject(key: string): Promise<void> {
    await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  },
};

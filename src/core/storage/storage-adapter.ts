export interface StorageAdapter {
  getSignedUploadUrl(key: string, contentType: string, ttlSeconds?: number): Promise<string>;
  getSignedDownloadUrl(key: string, ttlSeconds?: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
}

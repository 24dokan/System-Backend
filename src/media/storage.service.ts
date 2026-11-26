/** Where a browser should send a file. The same shape for every storage driver. */
export interface UploadTarget {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
}

/**
 * Storage contract. The rest of the app only knows this class, so switching from local files to
 * cloud storage is a configuration change (STORAGE_DRIVER), not a code change.
 */
export abstract class StorageService {
  abstract presignUpload(key: string, contentType: string, contentLength: number, ttlSeconds?: number): Promise<UploadTarget>;
  abstract presignDownload(key: string, ttlSeconds?: number): Promise<string>;
  /** Size of the stored object, or null if it is not there. */
  abstract objectSize(key: string): Promise<number | null>;
}

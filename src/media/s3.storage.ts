import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { StorageService, UploadTarget } from './storage.service';

/** Cloud driver: any S3-compatible service (AWS S3, Cloudflare R2, Backblaze B2, MinIO). STORAGE_DRIVER=s3. */
export class S3Storage extends StorageService {
  private s3: S3Client;
  private bucket: string;

  constructor(config: ConfigService) {
    super();
    this.bucket = config.getOrThrow('S3_BUCKET');
    this.s3 = new S3Client({
      region: config.get('S3_REGION', 'us-east-1'),
      endpoint: config.get('S3_ENDPOINT') || undefined,
      forcePathStyle: config.get('S3_FORCE_PATH_STYLE') === 'true',
      credentials: { accessKeyId: config.getOrThrow('S3_ACCESS_KEY'), secretAccessKey: config.getOrThrow('S3_SECRET_KEY') },
    });
  }

  async presignUpload(key: string, contentType: string, contentLength: number, ttlSeconds = 600): Promise<UploadTarget> {
    const url = await getSignedUrl(
      this.s3,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType, ContentLength: contentLength }),
      { expiresIn: ttlSeconds },
    );
    return { url, method: 'PUT', headers: { 'Content-Type': contentType } };
  }

  presignDownload(key: string, ttlSeconds = 3600) {
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: ttlSeconds });
  }

  async objectSize(key: string): Promise<number | null> {
    try {
      const head = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return head.ContentLength ?? null;
    } catch {
      return null;
    }
  }
}

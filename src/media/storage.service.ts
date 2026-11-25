import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/** Thin wrapper over S3-compatible storage (MinIO locally). */
@Injectable()
export class StorageService {
  private s3: S3Client;
  private bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow('S3_BUCKET');
    this.s3 = new S3Client({
      region: config.get('S3_REGION', 'us-east-1'),
      endpoint: config.get('S3_ENDPOINT'),
      forcePathStyle: config.get('S3_FORCE_PATH_STYLE') === 'true',
      credentials: { accessKeyId: config.getOrThrow('S3_ACCESS_KEY'), secretAccessKey: config.getOrThrow('S3_SECRET_KEY') },
    });
  }

  presignUpload(key: string, contentType: string, contentLength: number, ttlSeconds = 600) {
    return getSignedUrl(
      this.s3,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType, ContentLength: contentLength }),
      { expiresIn: ttlSeconds },
    );
  }

  presignDownload(key: string, ttlSeconds = 3600) {
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: ttlSeconds });
  }

  /** Size of the stored object, or null if it is not there. */
  async objectSize(key: string): Promise<number | null> {
    try {
      const head = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return head.ContentLength ?? null;
    } catch {
      return null;
    }
  }
}

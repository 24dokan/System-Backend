import { createHmac, timingSafeEqual } from 'crypto';
import { mkdir, open, rm, stat } from 'fs/promises';
import { dirname, resolve, sep } from 'path';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { ConfigService } from '@nestjs/config';
import { StorageService, UploadTarget } from './storage.service';

/**
 * Local driver (default): files are kept in a folder on this machine (STORAGE_LOCAL_DIR, default ./storage).
 * It mimics cloud storage: links are signed and expire, so the rest of the app behaves the same way.
 */
export class LocalStorage extends StorageService {
  readonly root: string;
  private secret: string;
  private base: string;

  constructor(config: ConfigService) {
    super();
    this.root = resolve(config.get('STORAGE_LOCAL_DIR') || './storage');
    this.secret = config.getOrThrow('JWT_ACCESS_SECRET');
    this.base = (config.get<string>('STORAGE_PUBLIC_URL') || '').replace(/\/$/, ''); // '' = same host (relative links)
  }

  /** Absolute path for a key. Throws if the key tries to leave the storage folder. */
  pathFor(key: string): string {
    const p = resolve(this.root, key);
    if (!p.startsWith(this.root + sep)) throw new Error('Invalid storage key');
    return p;
  }

  sign(action: 'put' | 'get', key: string, exp: number, size = 0): string {
    return createHmac('sha256', this.secret).update(`${action}:${key}:${exp}:${size}`).digest('hex');
  }

  verify(action: 'put' | 'get', key: string, exp: number, size: number, sig: string): boolean {
    if (!key || !Number.isFinite(exp) || exp < Date.now() / 1000 || !sig) return false;
    const want = Buffer.from(this.sign(action, key, exp, size));
    const got = Buffer.from(sig);
    return want.length === got.length && timingSafeEqual(want, got);
  }

  async presignUpload(key: string, contentType: string, contentLength: number, ttlSeconds = 600): Promise<UploadTarget> {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const q = new URLSearchParams({ key, exp: String(exp), size: String(contentLength), sig: this.sign('put', key, exp, contentLength) });
    return { url: `${this.base}/api/media/local/upload?${q}`, method: 'PUT', headers: { 'Content-Type': contentType } };
  }

  async presignDownload(key: string, ttlSeconds = 3600): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const q = new URLSearchParams({ key, exp: String(exp), sig: this.sign('get', key, exp) });
    return `${this.base}/api/media/local/file?${q}`;
  }

  async objectSize(key: string): Promise<number | null> {
    try {
      return (await stat(this.pathFor(key))).size;
    } catch {
      return null;
    }
  }

  /** Streams the upload to disk. Returns false (and removes the partial file) if it is not exactly `expected` bytes. */
  async write(key: string, body: Readable, expected: number): Promise<boolean> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    let file;
    try {
      file = await open(path, 'wx'); // 'wx': never overwrite an existing original
    } catch {
      return false;
    }
    let written = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        written += chunk.length;
        written > expected ? cb(new Error('Too many bytes')) : cb(null, chunk);
      },
    });
    try {
      await pipeline(body, limiter, file.createWriteStream());
    } catch {
      await rm(path, { force: true });
      return false;
    }
    if (written !== expected) { await rm(path, { force: true }); return false; }
    return true;
  }
}

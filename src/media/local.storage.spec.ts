import { mkdtempSync } from 'fs';
import { readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { ConfigService } from '@nestjs/config';
import { LocalStorage } from './local.storage';

const make = () => {
  const dir = mkdtempSync(join(tmpdir(), 'storage-'));
  const config = new ConfigService({ STORAGE_LOCAL_DIR: dir, JWT_ACCESS_SECRET: 'test-secret' });
  return { dir, storage: new LocalStorage(config) };
};

describe('LocalStorage', () => {
  it('rejects keys that escape the storage folder', () => {
    const { storage } = make();
    expect(() => storage.pathFor('../../etc/passwd')).toThrow();
    expect(() => storage.pathFor('sellers/a/original/x.png')).not.toThrow();
  });

  it('verifies signatures, and rejects tampering and expiry', () => {
    const { storage } = make();
    const exp = Math.floor(Date.now() / 1000) + 60;
    const sig = storage.sign('put', 'k.png', exp, 10);
    expect(storage.verify('put', 'k.png', exp, 10, sig)).toBe(true);
    expect(storage.verify('put', 'k.png', exp, 11, sig)).toBe(false); // different size
    expect(storage.verify('get', 'k.png', exp, 10, sig)).toBe(false); // different action
    expect(storage.verify('put', 'other.png', exp, 10, sig)).toBe(false);
    const past = Math.floor(Date.now() / 1000) - 5;
    expect(storage.verify('put', 'k.png', past, 10, storage.sign('put', 'k.png', past, 10))).toBe(false);
  });

  it('stores an upload of exactly the declared size, and never overwrites it', async () => {
    const { storage } = make();
    expect(await storage.write('a/b.bin', Readable.from([Buffer.from('hello')]), 5)).toBe(true);
    expect(readFileSync(storage.pathFor('a/b.bin'), 'utf8')).toBe('hello');
    expect(await storage.objectSize('a/b.bin')).toBe(5);
    expect(await storage.write('a/b.bin', Readable.from([Buffer.from('world')]), 5)).toBe(false);
    expect(readFileSync(storage.pathFor('a/b.bin'), 'utf8')).toBe('hello');
  });

  it('rejects and removes uploads with the wrong size', async () => {
    const { storage } = make();
    expect(await storage.write('c.bin', Readable.from([Buffer.from('too long')]), 3)).toBe(false);
    expect(await storage.objectSize('c.bin')).toBeNull();
    expect(await storage.write('d.bin', Readable.from([Buffer.from('ab')]), 3)).toBe(false);
    expect(await storage.objectSize('d.bin')).toBeNull();
  });
});

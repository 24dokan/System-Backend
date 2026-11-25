import { checkUpload } from './media.rules';

describe('checkUpload', () => {
  it('accepts a normal image', () => expect(checkUpload('image/png', 1_000_000)).toBeNull());
  it('rejects unknown types', () => expect(checkUpload('application/x-msdownload', 10)).toMatch(/not allowed/));
  it('rejects oversized images', () => expect(checkUpload('image/jpeg', 11 * 1024 * 1024)).toMatch(/too large/));
  it('allows bigger videos', () => expect(checkUpload('video/mp4', 150 * 1024 * 1024)).toBeNull());
  it('rejects empty files', () => expect(checkUpload('image/png', 0)).toMatch(/too large/));
});

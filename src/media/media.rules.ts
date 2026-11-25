import { MediaKind } from '@prisma/client';

const MB = 1024 * 1024;

export const ALLOWED: Record<string, { kind: MediaKind; maxBytes: number }> = {
  'image/jpeg': { kind: 'IMAGE', maxBytes: 10 * MB },
  'image/png': { kind: 'IMAGE', maxBytes: 10 * MB },
  'image/webp': { kind: 'IMAGE', maxBytes: 10 * MB },
  'image/gif': { kind: 'IMAGE', maxBytes: 10 * MB },
  'video/mp4': { kind: 'VIDEO', maxBytes: 200 * MB },
  'video/quicktime': { kind: 'VIDEO', maxBytes: 200 * MB },
  'application/pdf': { kind: 'FILE', maxBytes: 20 * MB },
};

/** Returns an error message, or null when the upload is acceptable. */
export function checkUpload(mimeType: string, sizeBytes: number): string | null {
  const rule = ALLOWED[mimeType];
  if (!rule) return `File type ${mimeType} is not allowed`;
  if (sizeBytes <= 0 || sizeBytes > rule.maxBytes) return `File is too large (max ${rule.maxBytes / MB} MB for this type)`;
  return null;
}

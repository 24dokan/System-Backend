import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { UploadUrlDto } from './dto/media.dto';
import { ALLOWED, checkUpload } from './media.rules';
import { StorageService } from './storage.service';

@Injectable()
export class MediaService {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  /** Step 1: reserve a media row and hand back a short-lived URL the browser uploads to directly. */
  async createUpload(user: AuthUser, dto: UploadUrlDto) {
    const problem = checkUpload(dto.mimeType, dto.sizeBytes);
    if (problem) throw new BadRequestException(problem);
    const ext = (dto.filename.split('.').pop() ?? '').replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase();
    // Originals are never overwritten: every upload gets its own key.
    const storageKey = `sellers/${user.sellerId}/original/${randomUUID()}${ext ? `.${ext}` : ''}`;
    const media = await this.prisma.media.create({
      data: { sellerId: user.sellerId!, kind: ALLOWED[dto.mimeType].kind, storageKey, mimeType: dto.mimeType, sizeBytes: dto.sizeBytes },
    });
    const target = await this.storage.presignUpload(storageKey, dto.mimeType, dto.sizeBytes);
    return { id: media.id, uploadUrl: target.url, method: target.method, headers: target.headers, expiresInSeconds: 600 };
  }

  /** Step 2: after uploading, the client confirms. We check the file really arrived at the declared size. */
  async confirm(user: AuthUser, id: string) {
    const media = await this.getOwned(user, id);
    const size = await this.storage.objectSize(media.storageKey);
    if (size === null) throw new BadRequestException('File has not been uploaded yet');
    if (size !== media.sizeBytes) throw new BadRequestException('Uploaded file size does not match what was declared');
    return this.prisma.media.update({ where: { id }, data: { uploaded: true } });
  }

  async downloadUrl(user: AuthUser, id: string) {
    const media = await this.getOwned(user, id);
    if (!media.uploaded) throw new NotFoundException('Media not found');
    return { url: await this.storage.presignDownload(media.storageKey) };
  }

  list(user: AuthUser) {
    return this.prisma.media.findMany({ where: { sellerId: user.sellerId!, uploaded: true }, orderBy: { createdAt: 'desc' } });
  }

  private async getOwned(user: AuthUser, id: string) {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media || (user.role !== 'ADMIN' && media.sellerId !== user.sellerId)) throw new NotFoundException('Media not found');
    return media;
  }
}

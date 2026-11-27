import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ENTITY_FIELDS, DeleteTranslationDto, SaveTranslationDto } from './dto/translations.dto';

@Injectable()
export class TranslationsService {
  constructor(private prisma: PrismaService) {}

  private async exists(type: string, id: string) {
    const found = type === 'product' ? await this.prisma.product.findUnique({ where: { id }, select: { id: true } })
      : type === 'category' ? await this.prisma.category.findUnique({ where: { id }, select: { id: true } })
      : await this.prisma.package.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException('Record not found');
  }

  list(entityType: string, entityId: string) {
    return this.prisma.translation.findMany({ where: { entityType, entityId }, orderBy: [{ locale: 'asc' }, { field: 'asc' }] });
  }

  async save(dto: SaveTranslationDto) {
    if (!ENTITY_FIELDS[dto.entityType].includes(dto.field)) throw new BadRequestException(`${dto.entityType} text can be translated for: ${ENTITY_FIELDS[dto.entityType].join(', ')}`);
    await this.exists(dto.entityType, dto.entityId);
    const key = { entityType: dto.entityType, entityId: dto.entityId, field: dto.field, locale: dto.locale };
    return this.prisma.translation.upsert({ where: { entityType_entityId_field_locale: key }, update: { text: dto.text }, create: { ...key, text: dto.text } });
  }

  async remove(dto: DeleteTranslationDto) {
    await this.prisma.translation.deleteMany({ where: { entityType: dto.entityType, entityId: dto.entityId, field: dto.field, locale: dto.locale } });
    return { ok: true };
  }

  /** For later: returns translated text for many records at once. Missing translations fall back to the original text on the record. */
  async lookup(entityType: string, ids: string[], locale: string) {
    const rows = await this.prisma.translation.findMany({ where: { entityType, entityId: { in: ids }, locale } });
    const out = new Map<string, Record<string, string>>();
    for (const r of rows) out.set(r.entityId, { ...(out.get(r.entityId) ?? {}), [r.field]: r.text });
    return out;
  }
}

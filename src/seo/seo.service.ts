import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { SeoDto } from './dto/seo.dto';
import { checkSeo, suggestSeo } from './seo.rules';

@Injectable()
export class SeoService {
  constructor(private prisma: PrismaService) {}

  private async checkImage(mediaId: string | null | undefined, sellerId: string) {
    if (!mediaId) return;
    const m = await this.prisma.media.findUnique({ where: { id: mediaId } });
    if (!m || m.sellerId !== sellerId || !m.uploaded || m.kind !== 'IMAGE') throw new BadRequestException('Choose an uploaded image that belongs to this seller');
  }

  private clean(dto: SeoDto) {
    const err = checkSeo(dto);
    if (err) throw new BadRequestException(err);
    const text = (v?: string) => (v === undefined ? undefined : v.trim() || null);
    return { slug: text(dto.slug), metaTitle: text(dto.metaTitle), metaDescription: text(dto.metaDescription), shareImageMediaId: dto.shareImageMediaId };
  }

  // ---------- products ----------

  private async product(user: AuthUser, id: string) {
    const p = await this.prisma.product.findUnique({ where: { id }, include: { seller: { select: { name: true } } } });
    if (!p || (user.role === 'SELLER' && p.sellerId !== user.sellerId)) throw new NotFoundException('Product not found');
    return p;
  }

  async getProduct(user: AuthUser, id: string) {
    const p = await this.product(user, id);
    return {
      slug: p.seoSlug, metaTitle: p.metaTitle, metaDescription: p.metaDescription, shareImageMediaId: p.shareImageMediaId,
      suggested: suggestSeo(p.name, p.description, p.seller.name),
    };
  }

  /** SEO text is not part of what the admin reviews, so it can change at any time, whatever the product's status. */
  async saveProduct(user: AuthUser, id: string, dto: SeoDto) {
    const p = await this.product(user, id);
    const d = this.clean(dto);
    await this.checkImage(d.shareImageMediaId, p.sellerId);
    if (d.slug) {
      const clash = await this.prisma.product.findFirst({ where: { seoSlug: d.slug, NOT: { id } }, select: { id: true } });
      if (clash) throw new ConflictException('This web address is already used by another product');
    }
    await this.prisma.product.update({ where: { id }, data: { seoSlug: d.slug, metaTitle: d.metaTitle, metaDescription: d.metaDescription, shareImageMediaId: d.shareImageMediaId } });
    return this.getProduct(user, id);
  }

  // ---------- sellers ----------

  async getSeller(sellerId: string) {
    const s = await this.prisma.seller.findUnique({ where: { id: sellerId } });
    if (!s) throw new NotFoundException('Seller not found');
    return {
      slug: s.slug, metaTitle: s.metaTitle, metaDescription: s.metaDescription, shareImageMediaId: s.shareImageMediaId,
      suggested: suggestSeo(s.name),
    };
  }

  async saveSeller(sellerId: string, dto: SeoDto) {
    const d = this.clean(dto);
    if (!(await this.prisma.seller.findUnique({ where: { id: sellerId } }))) throw new NotFoundException('Seller not found');
    await this.checkImage(d.shareImageMediaId, sellerId);
    if (d.slug) {
      const clash = await this.prisma.seller.findFirst({ where: { slug: d.slug, NOT: { id: sellerId } }, select: { id: true } });
      if (clash) throw new ConflictException('This web address is already used by another store');
    }
    await this.prisma.seller.update({ where: { id: sellerId }, data: { ...(d.slug ? { slug: d.slug } : {}), metaTitle: d.metaTitle, metaDescription: d.metaDescription, shareImageMediaId: d.shareImageMediaId } });
    return this.getSeller(sellerId);
  }
}

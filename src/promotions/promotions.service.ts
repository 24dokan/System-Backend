import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../common/current-user.decorator';
import { paging } from '../common/paging';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromotionDto, PromotionQuery } from './dto/promotions.dto';
import { checkPromotion, isLive, overlaps, salePrice } from './promo.rules';

@Injectable()
export class PromotionsService {
  constructor(private prisma: PrismaService) {}

  async create(user: AuthUser, dto: CreatePromotionDto) {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId }, include: { skus: { where: { isActive: true }, select: { id: true, priceMinor: true } } } });
    if (!product || product.sellerId !== user.sellerId) throw new NotFoundException('Product not found');
    if (product.status !== 'APPROVED') throw new BadRequestException('Only approved products can have a promotion');
    const covered = dto.skuId ? product.skus.filter((s) => s.id === dto.skuId) : product.skus;
    if (!covered.length) throw new BadRequestException(dto.skuId ? 'That variation is not part of this product' : 'This product has no active variations');
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    const err = checkPromotion({ type: dto.type, value: dto.value, startsAt, endsAt }, Math.min(...covered.map((s) => s.priceMinor)));
    if (err) throw new BadRequestException(err);
    const others = await this.prisma.promotion.findMany({ where: { productId: dto.productId, status: { in: ['PENDING', 'APPROVED'] }, endsAt: { gt: new Date() } } });
    const clash = others.find((o) => overlaps(o, { startsAt, endsAt }) && (!o.skuId || !dto.skuId || o.skuId === dto.skuId));
    if (clash) throw new ConflictException(`This overlaps with your promotion "${clash.name}". Change the dates or cancel that one first.`);
    return this.prisma.promotion.create({ data: { sellerId: user.sellerId!, productId: dto.productId, skuId: dto.skuId, name: dto.name.trim(), type: dto.type, value: dto.value, startsAt, endsAt } });
  }

  async list(user: AuthUser, q: PromotionQuery) {
    const { page, pageSize, limit, offset } = paging(q);
    const where: Prisma.PromotionWhereInput = {
      ...(user.role === 'SELLER' ? { sellerId: user.sellerId ?? '__none__' } : {}),
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.search ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { product: { name: { contains: q.search, mode: 'insensitive' } } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.promotion.findMany({
        where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset,
        include: { seller: { select: { name: true } }, product: { select: { name: true, skus: { select: { id: true, code: true, priceMinor: true } } } } },
      }),
      this.prisma.promotion.count({ where }),
    ]);
    const now = new Date();
    return {
      total, page, pageSize,
      rows: rows.map(({ product, seller, ...p }) => {
        const covered = p.skuId ? product.skus.filter((s) => s.id === p.skuId) : product.skus;
        const lowest = covered.length ? Math.min(...covered.map((s) => s.priceMinor)) : null;
        return {
          ...p, seller: seller.name, product: product.name, skuCode: covered.length === 1 && p.skuId ? covered[0].code : null,
          live: isLive(p as never, now), lowestPriceMinor: lowest, lowestSalePriceMinor: lowest === null ? null : salePrice(lowest, p),
        };
      }),
    };
  }

  async approve(user: AuthUser, id: string) {
    const r = await this.prisma.promotion.updateMany({ where: { id, status: 'PENDING', endsAt: { gt: new Date() } }, data: { status: 'APPROVED', decidedById: user.id, decidedAt: new Date(), rejectReason: null } });
    if (!r.count) throw new BadRequestException('Only a waiting promotion that has not ended can be approved');
    return this.prisma.promotion.findUniqueOrThrow({ where: { id } });
  }

  async reject(user: AuthUser, id: string, reason: string) {
    const r = await this.prisma.promotion.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'REJECTED', rejectReason: reason, decidedById: user.id, decidedAt: new Date() } });
    if (!r.count) throw new BadRequestException('Only a waiting promotion can be declined');
    return this.prisma.promotion.findUniqueOrThrow({ where: { id } });
  }

  /** The seller stops their own promotion. Staff with the review permission can stop any. */
  async cancel(user: AuthUser, id: string) {
    const p = await this.prisma.promotion.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Promotion not found');
    if (user.role === 'SELLER' && p.sellerId !== user.sellerId) throw new ForbiddenException();
    const r = await this.prisma.promotion.updateMany({ where: { id, status: { in: ['PENDING', 'APPROVED'] } }, data: { status: 'CANCELLED' } });
    if (!r.count) throw new BadRequestException('This promotion is already finished');
    return this.prisma.promotion.findUniqueOrThrow({ where: { id } });
  }

  /** For the storefront phase: the live promotion for each product, so prices can be shown with the original struck through. */
  async liveFor(productIds: string[], now = new Date()) {
    const rows = await this.prisma.promotion.findMany({ where: { productId: { in: productIds }, status: 'APPROVED', startsAt: { lte: now }, endsAt: { gt: now } } });
    return rows;
  }
}

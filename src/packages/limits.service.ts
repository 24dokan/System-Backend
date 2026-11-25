import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from './subscriptions.service';
import { COUNTED_PRODUCT_STATUSES, withinLimit } from './limits.util';

/** Used by the products and import modules before a product is submitted or imported. */
@Injectable()
export class LimitsService {
  constructor(private prisma: PrismaService, private subscriptions: SubscriptionsService) {}

  async usage(sellerId: string) {
    const statuses = [...COUNTED_PRODUCT_STATUSES];
    const [products, skus] = await Promise.all([
      this.prisma.product.count({ where: { sellerId, status: { in: statuses } } }),
      this.prisma.sku.count({ where: { product: { sellerId, status: { in: statuses } } } }),
    ]);
    return { products, skus };
  }

  /** Throws if adding this many products / SKUs would break the seller's package limits. */
  async assertCanAdd(sellerId: string, addProducts: number, addSkus: number) {
    const sub = await this.subscriptions.getActive(sellerId);
    if (!sub) throw new ForbiddenException('No active subscription. Choose a package and complete payment first.');
    const used = await this.usage(sellerId);
    const { maxProducts, maxSkus, name } = sub.package;
    if (!withinLimit(maxProducts, used.products, addProducts)) {
      throw new ForbiddenException(`Product limit reached for the ${name} package (${maxProducts}).`);
    }
    if (!withinLimit(maxSkus, used.skus, addSkus)) {
      throw new ForbiddenException(`SKU limit reached for the ${name} package (${maxSkus}).`);
    }
  }

  async summary(sellerId: string) {
    const sub = await this.subscriptions.getActive(sellerId);
    return {
      package: sub?.package.name ?? null,
      limits: sub ? { maxProducts: sub.package.maxProducts, maxSkus: sub.package.maxSkus } : null,
      used: await this.usage(sellerId),
    };
  }
}

import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalAction, Prisma } from '@prisma/client';
import { AuthUser } from '../common/current-user.decorator';
import { LimitsService } from '../packages/limits.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRevisionDto } from './dto/approval.dto';
import { missingFields } from '../sellers/profile.rules';
import { Transition, nextStatus } from './transitions';

type Tx = Prisma.TransactionClient;

@Injectable()
export class ApprovalService {
  constructor(private prisma: PrismaService, private limits: LimitsService) {}

  private async getVisible(user: AuthUser, id: string) {
    const p = await this.prisma.product.findUnique({ where: { id }, include: { skus: true } });
    if (!p || (user.role !== 'ADMIN' && p.sellerId !== user.sellerId)) throw new NotFoundException('Product not found');
    return p;
  }

  /**
   * Moves a product between statuses atomically and writes the history row.
   * The status check is part of the UPDATE, so two admins cannot both act on the same product.
   */
  private async transition(
    tx: Tx, productId: string, action: Transition, event: ApprovalAction, actorId: string,
    from: string, extra: Prisma.ProductUncheckedUpdateManyInput = {}, reason?: string,
  ) {
    const to = nextStatus(from as never, action);
    if (!to) throw new ConflictException(`Cannot ${action.toLowerCase().replace('_', ' ')} a product that is ${from}`);
    const res = await tx.product.updateMany({ where: { id: productId, status: from as never }, data: { status: to, ...extra } });
    if (res.count === 0) throw new ConflictException('Product was changed by someone else. Reload and try again.');
    await tx.approvalEvent.create({ data: { productId, action: event, actorId, reason } });
  }

  // ---------- seller ----------

  /** Draft or rejected -> pending. Checks the product is complete and the seller has room in their package. */
  async submit(user: AuthUser, productId: string) {
    const p = await this.getVisible(user, productId);
    const seller = await this.prisma.seller.findUnique({ where: { id: p.sellerId } });
    if (seller?.status !== 'APPROVED') throw new ForbiddenException('Your seller account must be approved first');
    const profile = await this.prisma.sellerProfile.findUnique({ where: { sellerId: p.sellerId } });
    const missing = missingFields(profile);
    if (missing.length) {
      const shown = missing.slice(0, 4).join(', ') + (missing.length > 4 ? ` and ${missing.length - 4} more` : '');
      throw new BadRequestException(`Complete your store profile before submitting products. Still missing: ${shown}`);
    }
    if (!p.skus.length) throw new BadRequestException('Add at least one variation (SKU) before submitting');
    if (p.skus.some((s) => s.priceMinor <= 0)) throw new BadRequestException('Every SKU needs a price above zero');

    await this.limits.assertCanAdd(p.sellerId, 1, p.skus.length);
    const event: ApprovalAction = p.status === 'REJECTED' ? 'RESUBMIT' : 'SUBMIT';
    await this.prisma.$transaction((tx) => this.transition(tx, productId, 'SUBMIT', event, user.id, p.status));
    return this.prisma.product.findUnique({ where: { id: productId } });
  }

  /** Proposes changes to an approved product. The live version stays untouched until an Admin approves. */
  async createRevision(user: AuthUser, productId: string, dto: CreateRevisionDto) {
    const p = await this.getVisible(user, productId);
    if (!dto.name && dto.description === undefined && !dto.categoryId && !dto.skus?.length) {
      throw new BadRequestException('No changes provided');
    }
    if (dto.categoryId) {
      const c = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!c || !c.isActive) throw new BadRequestException('Category not found or inactive');
    }
    const own = new Set(p.skus.map((s) => s.id));
    if (dto.skus?.some((s) => !own.has(s.skuId))) throw new BadRequestException('A SKU does not belong to this product');

    return this.prisma.$transaction(async (tx) => {
      await this.transition(tx, productId, 'REVISION_SUBMIT', 'REVISION_SUBMIT', user.id, p.status);
      return tx.productRevision.create({ data: { productId, changes: dto as unknown as Prisma.InputJsonValue } });
    });
  }

  listRevisions(user: AuthUser, productId: string) {
    return this.getVisible(user, productId).then(() =>
      this.prisma.productRevision.findMany({ where: { productId }, orderBy: { createdAt: 'desc' } }),
    );
  }

  async history(user: AuthUser, productId: string) {
    await this.getVisible(user, productId);
    return this.prisma.approvalEvent.findMany({ where: { productId }, orderBy: { createdAt: 'asc' } });
  }

  // ---------- admin ----------

  async queue(page = 1, pageSize = 20) {
    const [products, revisions] = await Promise.all([
      this.prisma.product.findMany({
        where: { status: 'PENDING' }, orderBy: { updatedAt: 'asc' }, skip: (page - 1) * pageSize, take: pageSize,
        include: { seller: true, category: true, skus: true, media: { include: { media: true } } },
      }),
      this.prisma.productRevision.findMany({
        where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, skip: (page - 1) * pageSize, take: pageSize,
        include: { product: { include: { seller: true, category: true, skus: true } } },
      }),
    ]);
    return { products, revisions, page, pageSize };
  }

  async approve(admin: AuthUser, productId: string) {
    const p = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!p) throw new NotFoundException('Product not found');
    // receivable: only approved products can be received into stock (used by inventory, area 1D).
    await this.prisma.$transaction((tx) => this.transition(tx, productId, 'APPROVE', 'APPROVE', admin.id, p.status, { receivable: true }));
    return this.prisma.product.findUnique({ where: { id: productId } });
  }

  async reject(admin: AuthUser, productId: string, reason: string) {
    const p = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!p) throw new NotFoundException('Product not found');
    await this.prisma.$transaction((tx) => this.transition(tx, productId, 'REJECT', 'REJECT', admin.id, p.status, {}, reason));
    return this.prisma.product.findUnique({ where: { id: productId } });
  }

  /** Applies the proposed changes and puts the product back to APPROVED, all in one transaction. */
  async approveRevision(admin: AuthUser, revisionId: string) {
    const rev = await this.prisma.productRevision.findUnique({ where: { id: revisionId }, include: { product: true } });
    if (!rev) throw new NotFoundException('Revision not found');
    if (rev.status !== 'PENDING') throw new ConflictException('Revision already decided');
    const c = rev.changes as unknown as CreateRevisionDto;

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.productRevision.updateMany({ where: { id: revisionId, status: 'PENDING' }, data: { status: 'APPLIED' } });
      if (claimed.count === 0) throw new ConflictException('Revision already decided');

      await this.transition(tx, rev.productId, 'REVISION_APPROVE', 'REVISION_APPROVE', admin.id, rev.product.status, {
        ...(c.name ? { name: c.name } : {}),
        ...(c.description !== undefined ? { description: c.description } : {}),
        ...(c.categoryId ? { categoryId: c.categoryId } : {}),
      });
      for (const s of c.skus ?? []) {
        await tx.sku.updateMany({ where: { id: s.skuId, productId: rev.productId }, data: { priceMinor: s.priceMinor, isActive: s.isActive } });
      }
    });
    return this.prisma.product.findUnique({ where: { id: rev.productId } });
  }

  async rejectRevision(admin: AuthUser, revisionId: string, reason: string) {
    const rev = await this.prisma.productRevision.findUnique({ where: { id: revisionId }, include: { product: true } });
    if (!rev) throw new NotFoundException('Revision not found');
    if (rev.status !== 'PENDING') throw new ConflictException('Revision already decided');

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.productRevision.updateMany({ where: { id: revisionId, status: 'PENDING' }, data: { status: 'REJECTED' } });
      if (claimed.count === 0) throw new ConflictException('Revision already decided');
      // The live product goes back to APPROVED, unchanged.
      await this.transition(tx, rev.productId, 'REVISION_REJECT', 'REVISION_REJECT', admin.id, rev.product.status, {}, reason);
    });
    return this.prisma.product.findUnique({ where: { id: rev.productId } });
  }
}

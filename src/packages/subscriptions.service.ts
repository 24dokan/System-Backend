import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Subscription } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConfirmPaymentDto } from './dto/packages.dto';

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  /** The one subscription that currently grants limits: ACTIVE and not past its end date. */
  getActive(sellerId: string) {
    return this.prisma.subscription.findFirst({
      where: { sellerId, status: 'ACTIVE', OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
      include: { package: true },
      orderBy: { startsAt: 'desc' },
    });
  }

  listForSeller(sellerId: string) {
    return this.prisma.subscription.findMany({
      where: { sellerId },
      include: { package: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  listAll(status?: Subscription['status']) {
    return this.prisma.subscription.findMany({
      where: { status },
      include: { package: true, seller: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** A seller picks a package. Billing only starts once the Admin has approved the seller account. */
  async subscribe(sellerId: string, packageId: string, byAdmin = false) {
    const [seller, pkg] = await Promise.all([
      this.prisma.seller.findUnique({ where: { id: sellerId } }),
      this.prisma.package.findUnique({ where: { id: packageId } }),
    ]);
    if (!seller) throw new NotFoundException('Seller not found');
    if (!pkg || !pkg.isActive) throw new NotFoundException('Package not found');
    if (pkg.isContactUs && !byAdmin) {
      throw new BadRequestException('This package is arranged with our team. Please contact us.');
    }
    if (seller.status === 'SUSPENDED') throw new BadRequestException('Seller account is suspended');

    // Only one open request at a time.
    const open = await this.prisma.subscription.findFirst({
      where: { sellerId, status: { in: ['PENDING_APPROVAL', 'AWAITING_PAYMENT'] } },
    });
    if (open) throw new ConflictException('There is already a subscription awaiting approval or payment');

    return this.prisma.subscription.create({
      data: {
        sellerId,
        packageId,
        status: seller.status === 'APPROVED' ? 'AWAITING_PAYMENT' : 'PENDING_APPROVAL',
      },
      include: { package: true },
    });
  }

  /** Called when an Admin approves a seller: waiting subscriptions move on to payment. */
  async onSellerApproved(sellerId: string) {
    await this.prisma.subscription.updateMany({
      where: { sellerId, status: 'PENDING_APPROVAL' },
      data: { status: 'AWAITING_PAYMENT' },
    });
  }

  /** Admin confirms a bank transfer arrived. Activates the subscription and replaces any previous active one. */
  async confirmPayment(subscriptionId: string, adminId: string, dto: ConfirmPaymentDto) {
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId }, include: { package: true } });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.status !== 'AWAITING_PAYMENT') throw new BadRequestException('Subscription is not awaiting payment');

    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    if (sub.package.billingPeriod === 'YEARLY') endsAt.setFullYear(endsAt.getFullYear() + 1);
    else endsAt.setMonth(endsAt.getMonth() + 1);

    const [, activated] = await this.prisma.$transaction([
      this.prisma.subscription.updateMany({
        where: { sellerId: sub.sellerId, status: 'ACTIVE' },
        data: { status: 'CANCELLED' },
      }),
      this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'ACTIVE',
          startsAt,
          endsAt,
          payments: {
            create: {
              amountMinor: dto.amountMinor,
              currency: sub.package.currency,
              reference: dto.reference,
              confirmedById: adminId,
            },
          },
        },
        include: { package: true, payments: true },
      }),
    ]);
    return activated;
  }

  async cancel(subscriptionId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.status === 'CANCELLED' || sub.status === 'EXPIRED') throw new BadRequestException('Already ended');
    return this.prisma.subscription.update({ where: { id: sub.id }, data: { status: 'CANCELLED' } });
  }
}

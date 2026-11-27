import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SellerProfile } from '@prisma/client';
import { AuthUser } from '../common/current-user.decorator';
import { PermissionsService } from '../permissions/permissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/profile.dto';
import { PROFILE_OPTIONS, maskTail, missingFields } from './profile.rules';

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService, private perms: PermissionsService) {}

  private shape(profile: SellerProfile | null) {
    const missing = missingFields(profile);
    return { profile: profile ?? {}, complete: missing.length === 0, missing };
  }

  /** The profile page opens only after the account is approved. */
  private async assertApproved(sellerId: string) {
    const seller = await this.prisma.seller.findUnique({ where: { id: sellerId } });
    if (!seller) throw new NotFoundException('Seller not found');
    if (seller.status !== 'APPROVED') throw new ForbiddenException('Your store profile opens once an administrator approves your account');
  }

  async getOwn(sellerId: string) {
    await this.assertApproved(sellerId);
    const profile = await this.prisma.sellerProfile.findUnique({ where: { sellerId } });
    return { ...this.shape(profile), options: PROFILE_OPTIONS };
  }

  async updateOwn(sellerId: string, dto: UpdateProfileDto) {
    await this.assertApproved(sellerId);
    // Blank text is stored as "not filled in".
    const data = Object.fromEntries(
      Object.entries(dto).map(([k, v]) => [k, typeof v === 'string' && v.trim() === '' ? null : typeof v === 'string' ? v.trim() : v]),
    );
    const existing = await this.prisma.sellerProfile.findUnique({ where: { sellerId } });
    const merged = { ...existing, ...data };
    const complete = missingFields(merged).length === 0;
    const completedAt = complete ? existing?.completedAt ?? new Date() : null;
    const profile = await this.prisma.sellerProfile.upsert({
      where: { sellerId },
      create: { ...data, sellerId, completedAt },
      update: { ...data, completedAt },
    });
    return { ...this.shape(profile), options: PROFILE_OPTIONS };
  }

  /** Staff view. ID and bank account numbers are masked unless the role has "sellers.view_sensitive"; full views are logged. */
  async getForStaff(user: AuthUser, sellerId: string) {
    const seller = await this.prisma.seller.findUnique({ where: { id: sellerId } });
    if (!seller) throw new NotFoundException('Seller not found');
    const profile = await this.prisma.sellerProfile.findUnique({ where: { sellerId } });
    const access = await this.perms.accessFor(user.id);
    const full = access.superAdmin || access.permissions.includes('sellers.view_sensitive');
    if (full && profile) await this.prisma.sellerProfileView.create({ data: { sellerId, userId: user.id } });
    const shown = profile && !full
      ? { ...profile, idNumber: maskTail(profile.idNumber), bankAccountNumber: maskTail(profile.bankAccountNumber) }
      : profile;
    return { seller: { id: seller.id, name: seller.name, status: seller.status }, ...this.shape(shown), sensitiveHidden: !full };
  }
}

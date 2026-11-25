import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SellerStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SellersService {
  constructor(private prisma: PrismaService) {}

  list(status?: SellerStatus) {
    return this.prisma.seller.findMany({ where: { status }, orderBy: { createdAt: 'desc' } });
  }

  async get(id: string) {
    const seller = await this.prisma.seller.findUnique({ where: { id } });
    if (!seller) throw new NotFoundException('Seller not found');
    return seller;
  }

  async setStatus(id: string, status: SellerStatus) {
    const seller = await this.get(id);
    if (seller.status === status) throw new BadRequestException(`Seller already ${status}`);
    return this.prisma.seller.update({ where: { id }, data: { status } });
  }
}

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FeaturesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.feature.findMany({ orderBy: { name: 'asc' } });
  }

  async create(name: string) {
    if (await this.prisma.feature.findUnique({ where: { name } })) {
      throw new ConflictException('Feature already exists');
    }
    return this.prisma.feature.create({ data: { name } });
  }

  async rename(id: string, name: string) {
    await this.get(id);
    const clash = await this.prisma.feature.findUnique({ where: { name } });
    if (clash && clash.id !== id) throw new ConflictException('Feature already exists');
    return this.prisma.feature.update({ where: { id }, data: { name } });
  }

  async get(id: string) {
    const f = await this.prisma.feature.findUnique({ where: { id } });
    if (!f) throw new NotFoundException('Feature not found');
    return f;
  }
}

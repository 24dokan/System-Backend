import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePackageDto, PackageFeatureDto, PaymentInstructionDto, SetPackageFeaturesDto, UpdatePackageDto,
} from './dto/packages.dto';
import { defaultMaxSkus } from './limits.util';

@Injectable()
export class PackagesService {
  constructor(private prisma: PrismaService) {}

  private include = {
    features: { include: { feature: true }, orderBy: { feature: { displayOrder: 'asc' as const } } },
  };

  /** Public plan comparison. */
  listActive() {
    return this.prisma.package.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      include: this.include,
    });
  }

  listAll() {
    return this.prisma.package.findMany({ orderBy: { displayOrder: 'asc' }, include: this.include });
  }

  async get(id: string) {
    const p = await this.prisma.package.findUnique({ where: { id }, include: this.include });
    if (!p) throw new NotFoundException('Package not found');
    return p;
  }

  async create(dto: CreatePackageDto) {
    if (await this.prisma.package.findUnique({ where: { name: dto.name } })) {
      throw new ConflictException('Package name already exists');
    }
    const maxProducts = dto.maxProducts ?? null;
    const maxSkus = dto.maxSkus === undefined ? defaultMaxSkus(maxProducts) : dto.maxSkus;
    return this.prisma.package.create({ data: { ...dto, maxProducts, maxSkus } });
  }

  async update(id: string, dto: UpdatePackageDto) {
    const current = await this.get(id);
    if (dto.name && dto.name !== current.name && (await this.prisma.package.findUnique({ where: { name: dto.name } }))) {
      throw new ConflictException('Package name already exists');
    }
    const data: Record<string, unknown> = { ...dto };
    // Raising/lowering the product cap moves the SKU cap with it, unless the admin set one explicitly.
    if (dto.maxProducts !== undefined && dto.maxSkus === undefined) {
      data.maxSkus = defaultMaxSkus(dto.maxProducts);
    }
    return this.prisma.package.update({ where: { id }, data });
  }

  // ----- feature checklist -----

  listFeatures() {
    return this.prisma.packageFeature.findMany({ orderBy: [{ groupName: 'asc' }, { displayOrder: 'asc' }] });
  }

  createFeature(dto: PackageFeatureDto) {
    return this.prisma.packageFeature.create({ data: dto });
  }

  async updateFeature(id: string, dto: PackageFeatureDto) {
    const f = await this.prisma.packageFeature.findUnique({ where: { id } });
    if (!f) throw new NotFoundException('Feature not found');
    return this.prisma.packageFeature.update({ where: { id }, data: dto });
  }

  /** Replaces the whole checklist for one package. */
  async setPackageFeatures(packageId: string, dto: SetPackageFeaturesDto) {
    await this.get(packageId);
    const ids = dto.features.map((f) => f.featureId);
    const found = await this.prisma.packageFeature.count({ where: { id: { in: ids } } });
    if (found !== new Set(ids).size) throw new NotFoundException('Unknown feature in list');
    await this.prisma.$transaction([
      this.prisma.packageFeatureLink.deleteMany({ where: { packageId } }),
      this.prisma.packageFeatureLink.createMany({
        data: dto.features.map((f) => ({ packageId, featureId: f.featureId, included: f.included ?? true, note: f.note })),
        skipDuplicates: true,
      }),
    ]);
    return this.get(packageId);
  }

  // ----- bank details -----

  getPaymentInstruction() {
    return this.prisma.paymentInstruction.findFirst({ where: { isActive: true }, orderBy: { updatedAt: 'desc' } });
  }

  async setPaymentInstruction(dto: PaymentInstructionDto) {
    await this.prisma.paymentInstruction.updateMany({ where: { isActive: true }, data: { isActive: false } });
    return this.prisma.paymentInstruction.create({ data: dto });
  }
}

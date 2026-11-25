import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Category } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/catalog.dto';

export type CategoryNode = Category & { children: CategoryNode[] };

/** Turns a flat list into a tree. Exported for unit testing. */
export function buildTree(all: Category[]): CategoryNode[] {
  const byId = new Map<string, CategoryNode>();
  all.forEach((c) => byId.set(c.id, { ...c, children: [] }));
  const roots: CategoryNode[] = [];
  byId.forEach((node) => {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  });
  return roots;
}

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async tree(includeInactive = false) {
    const all = await this.prisma.category.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    });
    return buildTree(all);
  }

  async get(id: string) {
    const c = await this.prisma.category.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Category not found');
    return c;
  }

  async create(dto: CreateCategoryDto) {
    if (dto.parentId) await this.get(dto.parentId);
    await this.assertNameFree(dto.name, dto.parentId ?? null);
    return this.prisma.category.create({
      data: { name: dto.name, parentId: dto.parentId, commissionPercent: dto.commissionPercent ?? 0 },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const current = await this.get(id);
    const parentId = dto.parentId === undefined ? current.parentId : dto.parentId;
    const name = dto.name ?? current.name;

    if (dto.parentId !== undefined && parentId) {
      await this.get(parentId);
      await this.assertNoCycle(id, parentId);
    }
    if (name !== current.name || parentId !== current.parentId) {
      await this.assertNameFree(name, parentId, id);
    }
    return this.prisma.category.update({
      where: { id },
      data: {
        name,
        parentId,
        commissionPercent: dto.commissionPercent,
        isActive: dto.isActive,
      },
    });
  }

  // Postgres treats NULLs as distinct, so top-level duplicates need an explicit check.
  private async assertNameFree(name: string, parentId: string | null, ignoreId?: string) {
    const clash = await this.prisma.category.findFirst({
      where: { name, parentId, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
    });
    if (clash) throw new ConflictException('A category with this name already exists here');
  }

  private async assertNoCycle(id: string, newParentId: string) {
    let cursor: string | null = newParentId;
    while (cursor) {
      if (cursor === id) throw new BadRequestException('A category cannot be moved under itself');
      const parent: { parentId: string | null } | null = await this.prisma.category.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = parent?.parentId ?? null;
    }
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ALL_PERMISSION_KEYS } from './permissions';

export interface Access {
  active: boolean;
  /** An administrator with no staff role is a super admin: everything is allowed. */
  superAdmin: boolean;
  permissions: string[];
}

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  /** Always read from the database, so removing a permission or switching off an account works at once. */
  async accessFor(userId: string): Promise<Access> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { staffRole: true } });
    if (!user || !user.isActive || user.role !== 'ADMIN') return { active: !!user?.isActive, superAdmin: false, permissions: [] };
    if (!user.staffRole) return { active: true, superAdmin: true, permissions: [...ALL_PERMISSION_KEYS] };
    return { active: true, superAdmin: false, permissions: user.staffRole.permissions };
  }
}

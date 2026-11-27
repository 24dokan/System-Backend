import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthUser } from '../common/current-user.decorator';
import { PERMISSIONS, isValidPermission } from '../permissions/permissions';
import { Access, PermissionsService } from '../permissions/permissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto, RoleDto, UpdateRoleDto, UpdateStaffDto } from './dto/staff.dto';

const STAFF_SELECT = { id: true, email: true, name: true, isActive: true, createdAt: true, staffRoleId: true, staffRole: { select: { id: true, name: true } } } as const;

/**
 * Rule that prevents privilege escalation: nobody can give out, or change something that carries,
 * a permission they do not hold themselves. A super admin holds everything.
 */
@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService, private perms: PermissionsService) {}

  registry() {
    return PERMISSIONS;
  }

  private async actor(user: AuthUser): Promise<Access> {
    return this.perms.accessFor(user.id);
  }

  private assertHolds(actor: Access, keys: string[], what: string) {
    if (actor.superAdmin) return;
    const missing = keys.filter((k) => !actor.permissions.includes(k));
    if (missing.length) throw new ForbiddenException(`You cannot ${what} because it includes permissions you do not have yourself`);
  }

  private cleanPermissions(keys: string[]) {
    const unique = [...new Set(keys)];
    const bad = unique.filter((k) => !isValidPermission(k));
    if (bad.length) throw new BadRequestException(`Unknown permission: ${bad.join(', ')}`);
    return unique;
  }

  // ---------- roles ----------

  async listRoles() {
    const roles = await this.prisma.staffRole.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { users: true } } } });
    return roles.map(({ _count, ...r }) => ({ ...r, staffCount: _count.users }));
  }

  async createRole(user: AuthUser, dto: RoleDto) {
    const permissions = this.cleanPermissions(dto.permissions);
    this.assertHolds(await this.actor(user), permissions, 'create this role');
    if (await this.prisma.staffRole.findUnique({ where: { name: dto.name } })) throw new ConflictException('A role with this name already exists');
    return this.prisma.staffRole.create({ data: { name: dto.name, description: dto.description, permissions } });
  }

  async updateRole(user: AuthUser, id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.staffRole.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    const permissions = dto.permissions ? this.cleanPermissions(dto.permissions) : role.permissions;
    this.assertHolds(await this.actor(user), [...role.permissions, ...permissions], 'change this role');
    if (dto.name && dto.name !== role.name && (await this.prisma.staffRole.findUnique({ where: { name: dto.name } }))) {
      throw new ConflictException('A role with this name already exists');
    }
    return this.prisma.staffRole.update({ where: { id }, data: { name: dto.name, description: dto.description, permissions } });
  }

  async deleteRole(user: AuthUser, id: string) {
    const role = await this.prisma.staffRole.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
    if (!role) throw new NotFoundException('Role not found');
    this.assertHolds(await this.actor(user), role.permissions, 'delete this role');
    if (role._count.users) throw new BadRequestException(`${role._count.users} staff member(s) still have this role. Move them to another role first.`);
    await this.prisma.staffRole.delete({ where: { id } });
  }

  // ---------- staff ----------

  /** Administrators only: staff with a role, and super admins (no role). */
  listStaff() {
    return this.prisma.user.findMany({ where: { role: 'ADMIN' }, select: STAFF_SELECT, orderBy: { createdAt: 'asc' } });
  }

  async createStaff(user: AuthUser, dto: CreateStaffDto) {
    const role = await this.prisma.staffRole.findUnique({ where: { id: dto.staffRoleId } });
    if (!role) throw new BadRequestException('Role not found');
    this.assertHolds(await this.actor(user), role.permissions, 'give this role');
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('Email already registered');
    return this.prisma.user.create({
      data: { email, name: dto.name, passwordHash: await argon2.hash(dto.password), role: 'ADMIN', staffRoleId: role.id },
      select: STAFF_SELECT,
    });
  }

  /** Loads a staff member the actor is allowed to change. */
  private async editable(user: AuthUser, id: string) {
    const target = await this.prisma.user.findFirst({ where: { id, role: 'ADMIN' }, include: { staffRole: true } });
    if (!target) throw new NotFoundException('Staff member not found');
    if (target.id === user.id) throw new ForbiddenException('You cannot change your own account here');
    const actor = await this.actor(user);
    if (!target.staffRole && !actor.superAdmin) throw new ForbiddenException('Only a super admin can change a super admin');
    if (target.staffRole) this.assertHolds(actor, target.staffRole.permissions, 'change this person');
    return { target, actor };
  }

  async updateStaff(user: AuthUser, id: string, dto: UpdateStaffDto) {
    const { target, actor } = await this.editable(user, id);
    if (dto.staffRoleId) {
      const role = await this.prisma.staffRole.findUnique({ where: { id: dto.staffRoleId } });
      if (!role) throw new BadRequestException('Role not found');
      this.assertHolds(actor, role.permissions, 'give this role');
    }
    return this.prisma.user.update({ where: { id: target.id }, data: { name: dto.name, staffRoleId: dto.staffRoleId, isActive: dto.isActive }, select: STAFF_SELECT });
  }

  async setPassword(user: AuthUser, id: string, password: string) {
    const { target } = await this.editable(user, id);
    await this.prisma.user.update({ where: { id: target.id }, data: { passwordHash: await argon2.hash(password) } });
  }
}

import { SetMetadata, applyDecorators } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { PermissionKey } from '../permissions/permissions';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(PUBLIC_KEY, true);

export const PERMISSION_KEY = 'permissions';

/** Admin-only route that also needs every listed permission. */
export const Permission = (...keys: PermissionKey[]) => applyDecorators(Roles('ADMIN'), SetMetadata(PERMISSION_KEY, keys));

/** For routes shared with sellers: when the caller is an administrator or staff member, these permissions are needed. */
export const AdminPermission = (...keys: PermissionKey[]) => SetMetadata(PERMISSION_KEY, keys);

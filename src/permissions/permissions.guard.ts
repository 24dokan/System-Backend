import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../common/roles.decorator';
import { PermissionsService } from './permissions.service';

/** Runs after login and role checks. Applies only to administrators and staff (sellers are covered by roles). */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector, private permissions: PermissionsService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const needed = this.reflector.getAllAndOverride<string[]>(PERMISSION_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!needed?.length) return true;
    const req = ctx.switchToHttp().getRequest();
    if (!req.user || req.user.role !== 'ADMIN') return true;
    const access = await this.permissions.accessFor(req.user.id);
    if (!access.active) throw new ForbiddenException('This account is switched off');
    if (!needed.every((k) => access.permissions.includes(k))) throw new ForbiddenException('You do not have permission to do this');
    return true;
  }
}

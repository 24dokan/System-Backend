import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

const ctx = (user: any) =>
  ({
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as any;

describe('RolesGuard', () => {
  const make = (roles?: string[]) => {
    const reflector = { getAllAndOverride: () => roles } as unknown as Reflector;
    return new RolesGuard(reflector);
  };
  it('allows when no roles required', () => expect(make().canActivate(ctx({ role: 'SELLER' }))).toBe(true));
  it('allows a matching role', () => expect(make(['ADMIN']).canActivate(ctx({ role: 'ADMIN' }))).toBe(true));
  it('blocks other roles', () =>
    expect(() => make(['ADMIN']).canActivate(ctx({ role: 'SELLER' }))).toThrow(ForbiddenException));
});

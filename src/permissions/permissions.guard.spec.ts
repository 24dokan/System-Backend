import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

const ctx = (user: any) =>
  ({ getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as any;

const make = (needed: string[] | undefined, access: any) =>
  new PermissionsGuard({ getAllAndOverride: () => needed } as unknown as Reflector, { accessFor: async () => access } as any);

describe('PermissionsGuard', () => {
  it('allows routes that need no permission', async () => expect(await make(undefined, null).canActivate(ctx({ id: '1', role: 'ADMIN' }))).toBe(true));
  it('does not apply to sellers (roles handle them)', async () => expect(await make(['products.view'], null).canActivate(ctx({ id: '1', role: 'SELLER' }))).toBe(true));
  it('allows staff who hold the permission', async () =>
    expect(await make(['sellers.approve'], { active: true, superAdmin: false, permissions: ['sellers.approve'] }).canActivate(ctx({ id: '1', role: 'ADMIN' }))).toBe(true));
  it('blocks staff who lack it', async () =>
    await expect(make(['sellers.approve'], { active: true, superAdmin: false, permissions: ['sellers.view'] }).canActivate(ctx({ id: '1', role: 'ADMIN' }))).rejects.toThrow(ForbiddenException));
  it('blocks switched-off accounts even with a valid token', async () =>
    await expect(make(['sellers.view'], { active: false, superAdmin: false, permissions: [] }).canActivate(ctx({ id: '1', role: 'ADMIN' }))).rejects.toThrow(ForbiddenException));
  it('needs every listed permission', async () =>
    await expect(make(['a', 'b'], { active: true, superAdmin: false, permissions: ['a'] }).canActivate(ctx({ id: '1', role: 'ADMIN' }))).rejects.toThrow(ForbiddenException));
});

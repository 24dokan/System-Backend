import { ForbiddenException } from '@nestjs/common';
import { StaffService } from './staff.service';

const actor = (permissions: string[], superAdmin = false) => ({ accessFor: async () => ({ active: true, superAdmin, permissions }) });
const make = (a: any, prisma: any = {}) => new StaffService(prisma, a);
const user = { id: 'u1', role: 'ADMIN', sellerId: null } as any;

describe('StaffService privilege rules', () => {
  it('rejects unknown permission keys', async () => {
    const svc = make(actor([], true), { staffRole: { findUnique: async () => null, create: async () => ({}) } });
    await expect(svc.createRole(user, { name: 'Bad', permissions: ['nope.nothing'] })).rejects.toThrow(/Unknown permission/);
  });

  it('stops staff creating a role with permissions they do not hold', async () => {
    const svc = make(actor(['roles.manage', 'sellers.view']), { staffRole: { findUnique: async () => null, create: async () => ({}) } });
    await expect(svc.createRole(user, { name: 'Boss', permissions: ['sellers.view', 'payments.confirm'] })).rejects.toThrow(ForbiddenException);
  });

  it('lets staff create a role within their own permissions', async () => {
    const created: any[] = [];
    const svc = make(actor(['roles.manage', 'sellers.view']), { staffRole: { findUnique: async () => null, create: async ({ data }: any) => (created.push(data), data) } });
    await svc.createRole(user, { name: 'Viewer', permissions: ['sellers.view', 'sellers.view'] });
    expect(created[0].permissions).toEqual(['sellers.view']);
  });

  it('lets a super admin grant anything', async () => {
    const svc = make(actor([], true), { staffRole: { findUnique: async () => null, create: async ({ data }: any) => data } });
    await expect(svc.createRole(user, { name: 'All', permissions: ['payments.confirm', 'staff.manage'] })).resolves.toBeDefined();
  });

  it('stops staff changing their own account, or a super admin', async () => {
    const prisma = (target: any) => ({ user: { findFirst: async () => target } });
    await expect(make(actor(['staff.manage']), prisma({ id: 'u1', staffRole: { permissions: [] } })).updateStaff(user, 'u1', { isActive: false })).rejects.toThrow(/own account/);
    await expect(make(actor(['staff.manage']), prisma({ id: 'u2', staffRole: null })).updateStaff(user, 'u2', { isActive: false })).rejects.toThrow(/super admin/);
  });

  it('stops staff changing someone who holds more permissions than they do', async () => {
    const prisma = { user: { findFirst: async () => ({ id: 'u2', staffRole: { permissions: ['payments.confirm'] } }) } };
    await expect(make(actor(['staff.manage']), prisma).updateStaff(user, 'u2', { name: 'X' })).rejects.toThrow(ForbiddenException);
  });
});

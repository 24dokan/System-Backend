import { BadRequestException } from '@nestjs/common';
import { OptionsService } from './options.service';

/** A tiny in-memory stand-in for the two library tables. */
function fakePrisma() {
  const defs: any[] = [];
  const vals: any[] = [];
  let n = 0;
  return {
    defs, vals,
    optionDefinition: {
      upsert: async ({ where, create }: any) => defs.find((d) => d.nameKey === where.nameKey) ?? (defs.push({ id: `d${++n}`, rejectionReason: null, ...create }), defs[defs.length - 1]),
      findUniqueOrThrow: async ({ where }: any) => ({ ...defs.find((d) => d.nameKey === where.nameKey), values: vals.filter((v) => v.definitionId === defs.find((d) => d.nameKey === where.nameKey).id) }),
    },
    optionDefinitionValue: {
      findUnique: async ({ where: { definitionId_valueKey: k } }: any) => vals.find((v) => v.definitionId === k.definitionId && v.valueKey === k.valueKey) ?? null,
      upsert: async ({ create }: any) => (vals.push({ id: `v${++n}`, rejectionReason: null, ...create }), vals[vals.length - 1]),
    },
  };
}
const approvedSize = (p: any) => {
  p.defs.push({ id: 'd0', name: 'Size', nameKey: 'size', status: 'APPROVED' });
  p.vals.push({ id: 'v0', definitionId: 'd0', value: 'M', valueKey: 'm', status: 'APPROVED' });
};

describe('OptionsService', () => {
  it('uses the library spelling for approved options and values', async () => {
    const p = fakePrisma(); approvedSize(p);
    const out = await new OptionsService(p as any).resolve('s1', [{ name: ' size ', values: ['m'] }]);
    expect(out).toEqual([{ name: 'Size', values: ['M'] }]);
    expect(p.defs).toHaveLength(1);
  });

  it('turns unknown options and values into pending requests', async () => {
    const p = fakePrisma(); approvedSize(p);
    const svc = new OptionsService(p as any);
    expect(await svc.unapproved('s1', [{ name: 'Size', values: ['M'] }])).toEqual([]);
    expect(await svc.unapproved('s1', [{ name: 'Size', values: ['M', 'XXXL'] }])).toEqual(['Size: XXXL']);
    expect(await svc.unapproved('s1', [{ name: 'Scent', values: ['Rose'] }])).toEqual(['Scent (new option)', 'Scent: Rose']);
    expect(p.vals.filter((v) => v.status === 'PENDING').map((v) => v.requestedBySellerId)).toEqual(['s1', 's1']);
  });

  it('refuses options and values the team declined', async () => {
    const p = fakePrisma(); approvedSize(p);
    p.vals.push({ id: 'v9', definitionId: 'd0', value: 'Giant', valueKey: 'giant', status: 'REJECTED', rejectionReason: 'Use real sizes' });
    await expect(new OptionsService(p as any).resolve('s1', [{ name: 'Size', values: ['Giant'] }])).rejects.toThrow(/declined.*Use real sizes/);
    p.defs.push({ id: 'd8', name: 'Vibe', nameKey: 'vibe', status: 'REJECTED', rejectionReason: null });
    await expect(new OptionsService(p as any).resolve('s1', [{ name: 'vibe', values: ['x'] }])).rejects.toThrow(BadRequestException);
  });
});

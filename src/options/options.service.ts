import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LibraryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const keyOf = (s: string) => s.trim().toLowerCase();
type Opt = { name: string; values: string[] };

@Injectable()
export class OptionsService {
  constructor(private prisma: PrismaService) {}

  // ---------- used by products and import ----------

  /**
   * Matches what a seller typed against the library and returns the library's spelling.
   * Anything not in the library yet becomes a PENDING request from this seller.
   * Throws if the team already declined that option or value.
   */
  async resolve(sellerId: string, options: Opt[]): Promise<Opt[]> {
    const out: Opt[] = [];
    for (const o of options) {
      const def = await this.prisma.optionDefinition.upsert({
        where: { nameKey: keyOf(o.name) },
        update: {},
        create: { name: o.name.trim(), nameKey: keyOf(o.name), status: 'PENDING', requestedBySellerId: sellerId },
      });
      if (def.status === 'REJECTED') throw new BadRequestException(`The option "${o.name}" was declined by the team${def.rejectionReason ? `: ${def.rejectionReason}` : ''}`);
      const values: string[] = [];
      for (const v of o.values) {
        const existing = await this.prisma.optionDefinitionValue.findUnique({ where: { definitionId_valueKey: { definitionId: def.id, valueKey: keyOf(v) } } });
        if (existing?.status === 'REJECTED') throw new BadRequestException(`The value "${v}" for ${def.name} was declined by the team${existing.rejectionReason ? `: ${existing.rejectionReason}` : ''}`);
        const row = existing ?? (await this.prisma.optionDefinitionValue.upsert({
          where: { definitionId_valueKey: { definitionId: def.id, valueKey: keyOf(v) } },
          update: {},
          create: { definitionId: def.id, value: v.trim(), valueKey: keyOf(v), status: 'PENDING', requestedBySellerId: sellerId },
        }));
        values.push(row.value);
      }
      out.push({ name: def.name, values });
    }
    return out;
  }

  /** Names of options and values that still wait for approval. Empty means the product may go to review. */
  async unapproved(sellerId: string, options: Opt[]): Promise<string[]> {
    const resolved = await this.resolve(sellerId, options);
    const waiting: string[] = [];
    for (const o of resolved) {
      const def = await this.prisma.optionDefinition.findUniqueOrThrow({ where: { nameKey: keyOf(o.name) }, include: { values: true } });
      if (def.status !== 'APPROVED') waiting.push(`${def.name} (new option)`);
      for (const v of o.values) {
        if (def.values.find((x) => x.valueKey === keyOf(v))?.status !== 'APPROVED') waiting.push(`${def.name}: ${v}`);
      }
    }
    return waiting;
  }

  // ---------- seller view ----------

  /** Approved entries, plus this seller's own pending requests. Used for suggestions and status badges. */
  async libraryFor(sellerId: string) {
    const defs = await this.prisma.optionDefinition.findMany({
      where: { OR: [{ status: 'APPROVED' }, { requestedBySellerId: sellerId, status: { not: 'REJECTED' } }] },
      include: { values: { where: { OR: [{ status: 'APPROVED' }, { requestedBySellerId: sellerId, status: { not: 'REJECTED' } }] }, orderBy: [{ position: 'asc' }, { value: 'asc' }] } },
      orderBy: { name: 'asc' },
    });
    return defs.map((d) => ({ id: d.id, name: d.name, status: d.status, values: d.values.map((v) => ({ value: v.value, status: v.status })) }));
  }

  // ---------- admin ----------

  list(status?: LibraryStatus) {
    const where: Prisma.OptionDefinitionWhereInput | undefined = status
      ? { OR: [{ status }, { values: { some: { status } } }] }
      : undefined;
    return this.prisma.optionDefinition.findMany({ where, include: { values: { orderBy: [{ position: 'asc' }, { value: 'asc' }] } }, orderBy: { name: 'asc' } });
  }

  async create(name: string, values: string[] = []) {
    const nameKey = keyOf(name);
    if (await this.prisma.optionDefinition.findUnique({ where: { nameKey } })) throw new BadRequestException('This option already exists');
    const unique = [...new Map(values.filter((v) => v.trim()).map((v) => [keyOf(v), v.trim()])).entries()];
    return this.prisma.optionDefinition.create({
      data: { name: name.trim(), nameKey, status: 'APPROVED', values: { create: unique.map(([valueKey, value], position) => ({ value, valueKey, position, status: 'APPROVED' })) } },
      include: { values: true },
    });
  }

  async rename(id: string, name: string) {
    await this.getDef(id);
    const nameKey = keyOf(name);
    const clash = await this.prisma.optionDefinition.findUnique({ where: { nameKey } });
    if (clash && clash.id !== id) throw new BadRequestException('Another option already has this name');
    return this.prisma.optionDefinition.update({ where: { id }, data: { name: name.trim(), nameKey } });
  }

  async addValues(id: string, values: string[]) {
    const def = await this.getDef(id);
    if (def.status !== 'APPROVED') throw new BadRequestException('Approve the option first');
    let position = await this.prisma.optionDefinitionValue.count({ where: { definitionId: id } });
    for (const v of values.filter((x) => x.trim())) {
      const valueKey = keyOf(v);
      // An existing request or declined value is turned into an approved one.
      await this.prisma.optionDefinitionValue.upsert({
        where: { definitionId_valueKey: { definitionId: id, valueKey } },
        update: { status: 'APPROVED', rejectionReason: null },
        create: { definitionId: id, value: v.trim(), valueKey, position: position++, status: 'APPROVED' },
      });
    }
    return this.prisma.optionDefinition.findUnique({ where: { id }, include: { values: true } });
  }

  /** Approving an option also approves the values that were requested together with it. */
  async decideDefinition(id: string, status: 'APPROVED' | 'REJECTED', reason?: string) {
    await this.getDef(id);
    const rejectionReason = status === 'REJECTED' ? reason ?? null : null;
    await this.prisma.$transaction([
      this.prisma.optionDefinition.update({ where: { id }, data: { status, rejectionReason } }),
      this.prisma.optionDefinitionValue.updateMany({ where: { definitionId: id, status: 'PENDING' }, data: { status, rejectionReason } }),
    ]);
    return this.prisma.optionDefinition.findUnique({ where: { id }, include: { values: true } });
  }

  async decideValue(valueId: string, status: 'APPROVED' | 'REJECTED', reason?: string) {
    const v = await this.prisma.optionDefinitionValue.findUnique({ where: { id: valueId }, include: { definition: true } });
    if (!v) throw new NotFoundException('Value not found');
    if (status === 'APPROVED' && v.definition.status !== 'APPROVED') throw new BadRequestException('Approve the option first');
    return this.prisma.optionDefinitionValue.update({ where: { id: valueId }, data: { status, rejectionReason: status === 'REJECTED' ? reason ?? null : null } });
  }

  async pendingCount() {
    const [definitions, values] = await Promise.all([
      this.prisma.optionDefinition.count({ where: { status: 'PENDING' } }),
      this.prisma.optionDefinitionValue.count({ where: { status: 'PENDING', definition: { status: 'APPROVED' } } }),
    ]);
    return { count: definitions + values };
  }

  private async getDef(id: string) {
    const d = await this.prisma.optionDefinition.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Option not found');
    return d;
  }
}

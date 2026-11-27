import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { BASE_CURRENCY, CURRENCIES, isKnownCurrency } from './currency.rules';

@Injectable()
export class CurrencyService {
  constructor(private prisma: PrismaService) {}

  /** Every known currency with its latest rate. The base currency always has rate 1. */
  async list() {
    const rates = await this.prisma.exchangeRate.findMany({ orderBy: { createdAt: 'desc' } });
    return CURRENCIES.map((c) => {
      const latest = rates.find((r) => r.currency === c.code);
      return { ...c, isBase: c.code === BASE_CURRENCY, rateToBase: c.code === BASE_CURRENCY ? 1 : latest ? Number(latest.rateToBase) : null, updatedAt: latest?.createdAt ?? null };
    });
  }

  async setRate(user: AuthUser, code: string, rateToBase: number, note?: string) {
    code = code.toUpperCase();
    if (!isKnownCurrency(code)) throw new BadRequestException('Unknown currency');
    if (code === BASE_CURRENCY) throw new BadRequestException(`${BASE_CURRENCY} is the base currency and always has rate 1`);
    await this.prisma.exchangeRate.create({ data: { currency: code, rateToBase, note, createdById: user.id } });
    return this.list();
  }

  history(code: string) {
    return this.prisma.exchangeRate.findMany({ where: { currency: code.toUpperCase() }, orderBy: { createdAt: 'desc' }, take: 50 });
  }
}

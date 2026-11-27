import { BadRequestException, Injectable } from '@nestjs/common';
import { toCsv } from '../import-export/csv.util';
import { PrismaService } from '../prisma/prisma.service';
import { ReportQuery } from './dto/orders.dto';
import * as r from './reports.queries';

const myDay = (offsetDays = 0) => new Date(Date.now() + 8 * 3600_000 - offsetDays * 86400_000).toISOString().slice(0, 10);

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}
  private run<T>(q: r.Query) { return this.prisma.$queryRawUnsafe<T[]>(q.text, ...q.params); }

  private filter(q: ReportQuery): r.ReportFilter {
    const f = { from: q.from ?? myDay(29), to: q.to ?? myDay(), sellerId: q.sellerId, source: q.source };
    if (f.from > f.to) throw new BadRequestException('The start date is after the end date');
    if ((Date.parse(f.to) - Date.parse(f.from)) / 86400_000 > 366) throw new BadRequestException('Choose a range of at most one year');
    return f;
  }

  async sales(q: ReportQuery) {
    const f = this.filter(q);
    const [t, days, sources, top] = await Promise.all([
      this.run<any>(r.totals(f)), this.run<any>(r.perDay(f)), this.run<any>(r.bySource(f)), this.run<any>(r.topProducts(f)),
    ]);
    // Fill days with no orders so the chart has no gaps.
    const byDay = new Map(days.map((d: any) => [d.day, d]));
    const series: { day: string; orders: number; revenueMinor: number }[] = [];
    for (let t0 = Date.parse(f.from); t0 <= Date.parse(f.to); t0 += 86400_000) {
      const day = new Date(t0).toISOString().slice(0, 10);
      series.push((byDay.get(day) as any) ?? { day, orders: 0, revenueMinor: 0 });
    }
    const tot = t[0] ?? { orders: 0, units: 0, revenueMinor: 0 };
    return { from: f.from, to: f.to, totals: { ...tot, averageMinor: tot.orders ? Math.round(tot.revenueMinor / tot.orders) : 0 }, perDay: series, bySource: sources, topProducts: top };
  }

  async csv(q: ReportQuery) {
    const rows = await this.run<any>(r.orderRows(this.filter(q)));
    return toCsv(['order', 'date', 'source', 'marketplace_ref', 'seller', 'customer', 'status', 'total_rm'],
      rows.map((o: any) => [o.number, o.day, o.source, o.ref, o.seller, o.customerName, o.status, (o.totalMinor / 100).toFixed(2)]));
  }
}

import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Permission, Roles } from '../common/roles.decorator';
import { toCsv } from '../import-export/csv.util';
import {
  AdjustDto, AlertLevelDto, CreateInboundDto, InboundQuery, LevelsQuery, MovementQuery, ReceiveDto, SentDto, SkuSearchQuery, StockQuery, UpdateWarehouseDto, WarehouseDto,
} from './dto/inventory.dto';
import { InboundService } from './inbound.service';
import { InventoryService } from './inventory.service';

@Controller()
export class InventoryController {
  constructor(private inv: InventoryService, private inbound: InboundService) {}

  // ----- warehouses -----
  @Roles('ADMIN') @Get('warehouses') warehouses() { return this.inv.warehousesWithTotals(); }
  @Permission('warehouses.manage') @Post('warehouses') createWarehouse(@Body() dto: WarehouseDto) { return this.inv.createWarehouse(dto); }
  @Permission('warehouses.manage') @Patch('warehouses/:id')
  updateWarehouse(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWarehouseDto) { return this.inv.updateWarehouse(id, dto); }

  // ----- stock -----
  @Permission('inventory.view') @Get('stock') overview(@Query() q: StockQuery) { return this.inv.overview(q); }
  @Roles('SELLER') @Get('stock/mine') mine(@CurrentUser() u: AuthUser, @Query() q: StockQuery) { return this.inv.mine(u.sellerId!, q); }
  @Permission('inventory.view') @Get('stock/low') low(@Query() q: StockQuery) { return this.inv.lowStock(q); }
  @Permission('inventory.view') @Get('stock/movements') movements(@Query() q: MovementQuery) { return this.inv.movements(q); }
  @Permission('inventory.view') @Get('stock/levels') levels(@Query() q: LevelsQuery) { return this.inv.levels(q.skuId); }
  /** Variation picker for forms (orders, shipments). Only needs a login as staff. */
  @Roles('ADMIN') @Get('skus/search') skus(@Query() q: SkuSearchQuery) { return this.inv.searchSkus(q); }
  @Permission('inventory.manage') @Post('stock/adjust') @HttpCode(200)
  adjust(@CurrentUser() u: AuthUser, @Body() dto: AdjustDto) { return this.inv.adjust(u, dto); }
  @Permission('inventory.manage') @Patch('stock/sku/:skuId/alert-level')
  alert(@Param('skuId', ParseUUIDPipe) id: string, @Body() dto: AlertLevelDto) { return this.inv.setAlertLevel(id, dto); }

  // ----- marketplace updates -----
  @Permission('inventory.view') @Get('marketplace-updates') pending(@Query() q: StockQuery) { return this.inv.pending(q); }
  @Permission('inventory.manage') @Post('marketplace-updates/sent') @HttpCode(200) sent(@Body() dto: SentDto) { return this.inv.markSent(dto.skuIds); }
  @Permission('inventory.view') @Get('marketplace-updates/file')
  async file(@Res() res: Response) {
    const rows = await this.inv.pendingFile();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="marketplace-stock-update.csv"');
    res.send(toCsv(['sku_code', 'product', 'variation', 'available_quantity'], rows.map((r) => [r.code, r.product, r.variation ?? '', String(Math.max(0, r.available))])));
  }

  // ----- inbound shipments -----
  @Permission('inventory.view') @Get('inbound') listInbound(@Query() q: InboundQuery) { return this.inbound.list(q); }
  @Permission('inventory.view') @Get('inbound/:id') getInbound(@Param('id', ParseUUIDPipe) id: string) { return this.inbound.get(id); }
  @Permission('inventory.manage') @Post('inbound') createInbound(@CurrentUser() u: AuthUser, @Body() dto: CreateInboundDto) { return this.inbound.create(u, dto); }
  @Permission('inventory.manage') @Post('inbound/:id/receive') @HttpCode(200)
  receive(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReceiveDto) { return this.inbound.receive(u, id, dto); }
  @Permission('inventory.manage') @Post('inbound/:id/cancel') @HttpCode(200)
  cancelInbound(@Param('id', ParseUUIDPipe) id: string) { return this.inbound.cancel(id); }
}

import { BadRequestException, Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { AdminPermission, Permission, Roles } from '../common/roles.decorator';
import { BulkIdsDto, CancelDto, CreateOrderDto, CreateReturnDto, ImportQuery, InspectDto, OrderQuery, ReportQuery, ReturnQuery } from './dto/orders.dto';
import { FulfilmentService } from './fulfilment.service';
import { OrdersService } from './orders.service';
import { ReportsService } from './reports.service';
import { ReturnsService } from './returns.service';

@Controller()
export class OrdersController {
  constructor(private orders: OrdersService, private fulfil: FulfilmentService, private returns: ReturnsService, private reports: ReportsService) {}

  // ----- orders -----
  @Roles('ADMIN', 'SELLER') @AdminPermission('orders.view') @Get('orders') list(@CurrentUser() u: AuthUser, @Query() q: OrderQuery) { return this.orders.list(u, q); }
  @Permission('orders.manage') @Get('orders/template.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8') @Header('Content-Disposition', 'attachment; filename="orders-template.csv"')
  template() { return this.orders.template(); }
  @Permission('orders.manage') @Get('orders/pick-list') pickList(@Query('ids') ids?: string) {
    return this.fulfil.pickList(ids ? ids.split(',').filter(Boolean) : undefined);
  }
  @Roles('ADMIN', 'SELLER') @AdminPermission('orders.view') @Get('orders/:id')
  get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.orders.get(u, id); }

  @Permission('orders.manage') @Post('orders') create(@CurrentUser() u: AuthUser, @Body() dto: CreateOrderDto) { return this.orders.create(u, dto); }
  @Permission('orders.manage') @Post('orders/import') @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  import(@CurrentUser() u: AuthUser, @Query() q: ImportQuery, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Attach a CSV file in the "file" field');
    return this.orders.importOrders(u, file.buffer, q.sellerId, q.warehouseId, q.create === true);
  }
  @Permission('orders.manage') @Post('orders/pack') @HttpCode(200) pack(@CurrentUser() u: AuthUser, @Body() dto: BulkIdsDto) { return this.fulfil.advance(u, 'pack', dto.ids); }
  @Permission('orders.manage') @Post('orders/ready') @HttpCode(200) ready(@CurrentUser() u: AuthUser, @Body() dto: BulkIdsDto) { return this.fulfil.advance(u, 'ready', dto.ids); }
  @Permission('orders.manage') @Post('orders/ship') @HttpCode(200) ship(@CurrentUser() u: AuthUser, @Body() dto: BulkIdsDto) { return this.fulfil.ship(u, dto.ids); }
  @Permission('orders.cancel') @Post('orders/:id/cancel') @HttpCode(200)
  cancel(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelDto) { return this.fulfil.cancel(u, id, dto.reason); }

  // ----- returns -----
  @Roles('ADMIN', 'SELLER') @AdminPermission('returns.manage') @Get('returns') listReturns(@CurrentUser() u: AuthUser, @Query() q: ReturnQuery) { return this.returns.list(u, q); }
  @Permission('returns.manage') @Post('returns') createReturn(@CurrentUser() u: AuthUser, @Body() dto: CreateReturnDto) { return this.returns.create(u, dto); }
  @Permission('returns.manage') @Post('returns/:id/inspect') @HttpCode(200)
  inspect(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: InspectDto) { return this.returns.inspect(u, id, dto); }

  // ----- reports -----
  @Permission('reports.view') @Get('reports/sales') sales(@Query() q: ReportQuery) { return this.reports.sales(q); }
  @Permission('reports.view') @Get('reports/sales.csv')
  async salesCsv(@Query() q: ReportQuery, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sales-report.csv"');
    res.send(await this.reports.csv(q));
  }
}

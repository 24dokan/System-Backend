import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { FulfilmentService } from './fulfilment.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ReportsService } from './reports.service';
import { ReturnsService } from './returns.service';

@Module({
  imports: [InventoryModule],
  controllers: [OrdersController],
  providers: [OrdersService, FulfilmentService, ReturnsService, ReportsService],
})
export class OrdersModule {}

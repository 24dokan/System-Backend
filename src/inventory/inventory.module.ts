import { Module } from '@nestjs/common';
import { InboundService } from './inbound.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { StockService } from './stock.service';

@Module({
  controllers: [InventoryController],
  providers: [StockService, InventoryService, InboundService],
  exports: [StockService],
})
export class InventoryModule {}

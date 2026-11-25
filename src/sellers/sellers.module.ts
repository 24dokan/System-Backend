import { Module } from '@nestjs/common';
import { PackagesModule } from '../packages/packages.module';
import { SellersController } from './sellers.controller';
import { SellersService } from './sellers.service';

@Module({ imports: [PackagesModule], controllers: [SellersController], providers: [SellersService], exports: [SellersService] })
export class SellersModule {}

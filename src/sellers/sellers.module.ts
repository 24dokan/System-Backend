import { Module } from '@nestjs/common';
import { PackagesModule } from '../packages/packages.module';
import { SellersController } from './sellers.controller';
import { ProfileService } from './profile.service';
import { SellersService } from './sellers.service';

@Module({ imports: [PackagesModule], controllers: [SellersController], providers: [SellersService, ProfileService], exports: [SellersService, ProfileService] })
export class SellersModule {}

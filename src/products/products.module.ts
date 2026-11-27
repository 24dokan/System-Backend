import { Module } from '@nestjs/common';
import { OptionsModule } from '../options/options.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({ imports: [OptionsModule], controllers: [ProductsController], providers: [ProductsService], exports: [ProductsService] })
export class ProductsModule {}

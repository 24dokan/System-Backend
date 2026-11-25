import { Module } from '@nestjs/common';
import { CategoriesController, FeaturesController } from './catalog.controller';
import { CategoriesService } from './categories.service';
import { FeaturesService } from './features.service';

@Module({
  controllers: [FeaturesController, CategoriesController],
  providers: [FeaturesService, CategoriesService],
  exports: [FeaturesService, CategoriesService],
})
export class CatalogModule {}

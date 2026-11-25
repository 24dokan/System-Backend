import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../common/roles.decorator';
import { CategoriesService } from './categories.service';
import { FeaturesService } from './features.service';
import { CreateCategoryDto, FeatureDto, UpdateCategoryDto } from './dto/catalog.dto';

// Reads are open to any logged-in user. Writes are Admin only.
@Controller('features')
export class FeaturesController {
  constructor(private features: FeaturesService) {}

  @Get() list() { return this.features.list(); }
  @Roles('ADMIN') @Post() create(@Body() dto: FeatureDto) { return this.features.create(dto.name); }
  @Roles('ADMIN') @Patch(':id')
  rename(@Param('id', ParseUUIDPipe) id: string, @Body() dto: FeatureDto) {
    return this.features.rename(id, dto.name);
  }
}

@Controller('categories')
export class CategoriesController {
  constructor(private categories: CategoriesService) {}

  @Get() tree(@Query('includeInactive') includeInactive?: string) {
    return this.categories.tree(includeInactive === 'true');
  }
  @Roles('ADMIN') @Post() create(@Body() dto: CreateCategoryDto) { return this.categories.create(dto); }
  @Roles('ADMIN') @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }
}

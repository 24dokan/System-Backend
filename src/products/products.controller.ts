import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import {
  CreateProductDto, GenerateSkusDto, ListProductsQuery, SetOptionsDto, SetProductFeaturesDto, SetProductMediaDto, UpdateProductDto, UpdateSkuDto,
} from './dto/products.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private products: ProductsService) {}

  @Roles('SELLER') @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateProductDto) { return this.products.create(u, dto); }

  @Roles('SELLER', 'ADMIN') @Get()
  list(@CurrentUser() u: AuthUser, @Query() q: ListProductsQuery) { return this.products.list(u, q); }

  @Roles('SELLER', 'ADMIN') @Get(':id')
  get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.products.getVisible(u, id); }

  @Roles('SELLER') @Patch(':id')
  update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(u, id, dto);
  }

  @Roles('SELLER') @Delete(':id') @HttpCode(204)
  remove(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.products.deleteProduct(u, id); }

  @Roles('SELLER') @Put(':id/options')
  setOptions(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetOptionsDto) {
    return this.products.setOptions(u, id, dto);
  }

  @Roles('SELLER') @Post(':id/skus/generate')
  generate(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: GenerateSkusDto) {
    return this.products.generateSkus(u, id, dto);
  }

  @Roles('SELLER') @Patch(':id/skus/:skuId')
  updateSku(
    @CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string,
    @Param('skuId', ParseUUIDPipe) skuId: string, @Body() dto: UpdateSkuDto,
  ) { return this.products.updateSku(u, id, skuId, dto); }

  @Roles('SELLER') @Put(':id/features')
  setFeatures(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetProductFeaturesDto) {
    return this.products.setFeatures(u, id, dto);
  }

  @Roles('SELLER') @Put(':id/media')
  setMedia(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetProductMediaDto) {
    return this.products.setMedia(u, id, dto);
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { AdminPermission, Permission, Roles } from '../common/roles.decorator';
import { SeoDto } from './dto/seo.dto';
import { SeoService } from './seo.service';

@Controller('seo')
export class SeoController {
  constructor(private seo: SeoService) {}

  @Roles('SELLER', 'ADMIN') @AdminPermission('seo.manage') @Get('products/:id')
  product(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.seo.getProduct(u, id); }

  @Roles('SELLER', 'ADMIN') @AdminPermission('seo.manage') @Put('products/:id')
  saveProduct(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SeoDto) { return this.seo.saveProduct(u, id, dto); }

  @Roles('SELLER') @Get('store')
  myStore(@CurrentUser() u: AuthUser) { return this.seo.getSeller(u.sellerId!); }

  @Roles('SELLER') @Put('store')
  saveMyStore(@CurrentUser() u: AuthUser, @Body() dto: SeoDto) { return this.seo.saveSeller(u.sellerId!, dto); }

  @Permission('seo.manage') @Get('sellers/:id')
  seller(@Param('id', ParseUUIDPipe) id: string) { return this.seo.getSeller(id); }

  @Permission('seo.manage') @Put('sellers/:id')
  saveSeller(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SeoDto) { return this.seo.saveSeller(id, dto); }
}

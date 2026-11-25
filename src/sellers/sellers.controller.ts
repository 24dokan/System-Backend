import { Controller, Get, Param, ParseEnumPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { SellerStatus } from '@prisma/client';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { SellersService } from './sellers.service';

@Controller('sellers')
export class SellersController {
  constructor(private sellers: SellersService) {}

  /** A seller reads its own profile. */
  @Roles('SELLER') @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.sellers.get(user.sellerId!);
  }

  @Roles('ADMIN') @Get()
  list(@Query('status', new ParseEnumPipe(SellerStatus, { optional: true })) status?: SellerStatus) {
    return this.sellers.list(status);
  }

  @Roles('ADMIN') @Post(':id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.sellers.setStatus(id, 'APPROVED');
  }

  @Roles('ADMIN') @Post(':id/suspend')
  suspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.sellers.setStatus(id, 'SUSPENDED');
  }
}

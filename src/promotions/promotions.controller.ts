import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { AdminPermission, Permission, Roles } from '../common/roles.decorator';
import { CreatePromotionDto, PromotionQuery, RejectPromotionDto } from './dto/promotions.dto';
import { PromotionsService } from './promotions.service';

@Controller('promotions')
export class PromotionsController {
  constructor(private promos: PromotionsService) {}

  @Roles('SELLER') @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: CreatePromotionDto) { return this.promos.create(u, dto); }

  @Roles('SELLER', 'ADMIN') @AdminPermission('promotions.review') @Get()
  list(@CurrentUser() u: AuthUser, @Query() q: PromotionQuery) { return this.promos.list(u, q); }

  @Permission('promotions.review') @Post(':id/approve') @HttpCode(200)
  approve(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.promos.approve(u, id); }

  @Permission('promotions.review') @Post(':id/reject') @HttpCode(200)
  reject(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectPromotionDto) { return this.promos.reject(u, id, dto.reason); }

  @Roles('SELLER', 'ADMIN') @AdminPermission('promotions.review') @Post(':id/cancel') @HttpCode(200)
  cancel(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.promos.cancel(u, id); }
}

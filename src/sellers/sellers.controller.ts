import { Body, Controller, Get, Patch, Param, ParseEnumPipe, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { SellerStatus } from '@prisma/client';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Roles, Permission } from '../common/roles.decorator';
import { UpdateBrandProfileDto } from '../catalog/dto/catalog.dto';
import { UpdateProfileDto } from './dto/profile.dto';
import { ProfileService } from './profile.service';
import { SellersService } from './sellers.service';

@Controller('sellers')
export class SellersController {
  constructor(private sellers: SellersService, private profiles: ProfileService) {}

  /** A seller reads its own profile. */
  @Roles('SELLER') @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.sellers.get(user.sellerId!);
  }

  /** A seller edits its own brand profile. */
  @Roles('SELLER') @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateBrandProfileDto) {
    return this.sellers.updateProfile(user.sellerId!, dto);
  }

  /** The seller's store profile (company, bank, e-invoicing). Opens after approval. */
  @Roles('SELLER') @Get('me/profile')
  myProfile(@CurrentUser() user: AuthUser) {
    return this.profiles.getOwn(user.sellerId!);
  }

  @Roles('SELLER') @Put('me/profile')
  saveMyProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.profiles.updateOwn(user.sellerId!, dto);
  }

  @Permission('sellers.view') @Get(':id/profile')
  profileForStaff(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.profiles.getForStaff(user, id);
  }

  @Permission('sellers.view') @Get()
  list(@Query('status', new ParseEnumPipe(SellerStatus, { optional: true })) status?: SellerStatus) {
    return this.sellers.list(status);
  }

  @Permission('sellers.approve') @Post(':id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.sellers.setStatus(id, 'APPROVED');
  }

  @Permission('sellers.suspend') @Post(':id/suspend')
  suspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.sellers.setStatus(id, 'SUSPENDED');
  }
}

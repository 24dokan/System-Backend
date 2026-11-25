import { Body, Controller, Get, Param, ParseEnumPipe, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Public, Roles } from '../common/roles.decorator';
import {
  AdminAssignDto, ConfirmPaymentDto, CreatePackageDto, PackageFeatureDto, PaymentInstructionDto,
  SetPackageFeaturesDto, SubscribeDto, UpdatePackageDto,
} from './dto/packages.dto';
import { LimitsService } from './limits.service';
import { PackagesService } from './packages.service';
import { SubscriptionsService } from './subscriptions.service';

@Controller('packages')
export class PackagesController {
  constructor(private packages: PackagesService) {}

  @Public() @Get() list() { return this.packages.listActive(); }
  @Roles('ADMIN') @Get('all') listAll() { return this.packages.listAll(); }
  @Roles('ADMIN') @Post() create(@Body() dto: CreatePackageDto) { return this.packages.create(dto); }
  @Roles('ADMIN') @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePackageDto) { return this.packages.update(id, dto); }
  @Roles('ADMIN') @Put(':id/features')
  setFeatures(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetPackageFeaturesDto) {
    return this.packages.setPackageFeatures(id, dto);
  }
}

@Controller('package-features')
export class PackageFeaturesController {
  constructor(private packages: PackagesService) {}

  @Roles('ADMIN') @Get() list() { return this.packages.listFeatures(); }
  @Roles('ADMIN') @Post() create(@Body() dto: PackageFeatureDto) { return this.packages.createFeature(dto); }
  @Roles('ADMIN') @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PackageFeatureDto) { return this.packages.updateFeature(id, dto); }
}

@Controller('payment-instruction')
export class PaymentInstructionController {
  constructor(private packages: PackagesService) {}

  @Roles('ADMIN', 'SELLER') @Get() get() { return this.packages.getPaymentInstruction(); }
  @Roles('ADMIN') @Put() set(@Body() dto: PaymentInstructionDto) { return this.packages.setPaymentInstruction(dto); }
}

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private subs: SubscriptionsService, private limits: LimitsService) {}

  // Seller
  @Roles('SELLER') @Post()
  subscribe(@CurrentUser() u: AuthUser, @Body() dto: SubscribeDto) { return this.subs.subscribe(u.sellerId!, dto.packageId); }
  @Roles('SELLER') @Get('mine') mine(@CurrentUser() u: AuthUser) { return this.subs.listForSeller(u.sellerId!); }
  @Roles('SELLER') @Get('usage') usage(@CurrentUser() u: AuthUser) { return this.limits.summary(u.sellerId!); }

  // Admin
  @Roles('ADMIN') @Get()
  all(@Query('status', new ParseEnumPipe(SubscriptionStatus, { optional: true })) status?: SubscriptionStatus) {
    return this.subs.listAll(status);
  }
  @Roles('ADMIN') @Post('assign')
  assign(@Body() dto: AdminAssignDto) { return this.subs.subscribe(dto.sellerId, dto.packageId, true); }
  @Roles('ADMIN') @Post(':id/confirm-payment')
  confirm(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @Body() dto: ConfirmPaymentDto) {
    return this.subs.confirmPayment(id, u.id, dto);
  }
  @Roles('ADMIN') @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string) { return this.subs.cancel(id); }
}

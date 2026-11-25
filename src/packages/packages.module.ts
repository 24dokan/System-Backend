import { Module } from '@nestjs/common';
import {
  PackageFeaturesController, PackagesController, PaymentInstructionController, SubscriptionsController,
} from './packages.controller';
import { LimitsService } from './limits.service';
import { PackagesService } from './packages.service';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  controllers: [PackagesController, PackageFeaturesController, PaymentInstructionController, SubscriptionsController],
  providers: [PackagesService, SubscriptionsService, LimitsService],
  // LimitsService is what the products and import modules call.
  exports: [SubscriptionsService, LimitsService],
})
export class PackagesModule {}

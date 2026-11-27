import { Module } from '@nestjs/common';
import { OptionsModule } from '../options/options.module';
import { PackagesModule } from '../packages/packages.module';
import { ApprovalController } from './approval.controller';
import { ApprovalService } from './approval.service';

@Module({
  imports: [PackagesModule, OptionsModule],
  controllers: [ApprovalController],
  providers: [ApprovalService],
  exports: [ApprovalService],
})
export class ApprovalModule {}

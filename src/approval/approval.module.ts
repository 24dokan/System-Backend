import { Module } from '@nestjs/common';
import { PackagesModule } from '../packages/packages.module';
import { ApprovalController } from './approval.controller';
import { ApprovalService } from './approval.service';

@Module({
  imports: [PackagesModule],
  controllers: [ApprovalController],
  providers: [ApprovalService],
  exports: [ApprovalService],
})
export class ApprovalModule {}

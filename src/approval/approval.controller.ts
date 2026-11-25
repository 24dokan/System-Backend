import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { ApprovalService } from './approval.service';
import { CreateRevisionDto, QueueQuery, RejectDto } from './dto/approval.dto';

@Controller()
export class ApprovalController {
  constructor(private approval: ApprovalService) {}

  // ----- seller -----
  @Roles('SELLER') @Post('products/:id/submit') @HttpCode(200)
  submit(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.approval.submit(u, id); }

  @Roles('SELLER') @Post('products/:id/revisions')
  revise(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateRevisionDto) {
    return this.approval.createRevision(u, id, dto);
  }

  // ----- seller (own) and admin -----
  @Roles('SELLER', 'ADMIN') @Get('products/:id/revisions')
  revisions(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.approval.listRevisions(u, id); }

  @Roles('SELLER', 'ADMIN') @Get('products/:id/history')
  history(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.approval.history(u, id); }

  // ----- admin -----
  @Roles('ADMIN') @Get('approval/queue')
  queue(@Query() q: QueueQuery) { return this.approval.queue(q.page, q.pageSize); }

  @Roles('ADMIN') @Post('approval/products/:id/approve') @HttpCode(200)
  approve(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.approval.approve(u, id); }

  @Roles('ADMIN') @Post('approval/products/:id/reject') @HttpCode(200)
  reject(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectDto) {
    return this.approval.reject(u, id, dto.reason);
  }

  @Roles('ADMIN') @Post('approval/revisions/:id/approve') @HttpCode(200)
  approveRevision(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.approval.approveRevision(u, id); }

  @Roles('ADMIN') @Post('approval/revisions/:id/reject') @HttpCode(200)
  rejectRevision(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectDto) {
    return this.approval.rejectRevision(u, id, dto.reason);
  }
}

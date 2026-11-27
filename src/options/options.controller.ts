import { Body, Controller, Get, HttpCode, Param, ParseEnumPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { LibraryStatus } from '@prisma/client';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Permission, Roles } from '../common/roles.decorator';
import { AddValuesDto, CreateOptionDto, RejectDto, RenameOptionDto } from './dto/options.dto';
import { OptionsService } from './options.service';

@Controller()
export class OptionsController {
  constructor(private options: OptionsService) {}

  /** Seller: approved options and values, plus their own pending requests. */
  @Roles('SELLER') @Get('options/library')
  library(@CurrentUser() u: AuthUser) { return this.options.libraryFor(u.sellerId!); }

  @Permission('options.manage') @Get('admin/options')
  list(@Query('status', new ParseEnumPipe(LibraryStatus, { optional: true })) status?: LibraryStatus) { return this.options.list(status); }

  @Permission('options.manage') @Get('admin/options/pending-count')
  pending() { return this.options.pendingCount(); }

  @Permission('options.manage') @Post('admin/options')
  create(@Body() dto: CreateOptionDto) { return this.options.create(dto.name, dto.values); }

  @Permission('options.manage') @Patch('admin/options/:id')
  rename(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RenameOptionDto) { return this.options.rename(id, dto.name); }

  @Permission('options.manage') @Post('admin/options/:id/values')
  addValues(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddValuesDto) { return this.options.addValues(id, dto.values); }

  @Permission('options.manage') @Post('admin/options/:id/approve') @HttpCode(200)
  approve(@Param('id', ParseUUIDPipe) id: string) { return this.options.decideDefinition(id, 'APPROVED'); }

  @Permission('options.manage') @Post('admin/options/:id/reject') @HttpCode(200)
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectDto) { return this.options.decideDefinition(id, 'REJECTED', dto.reason); }

  @Permission('options.manage') @Post('admin/options/values/:valueId/approve') @HttpCode(200)
  approveValue(@Param('valueId', ParseUUIDPipe) id: string) { return this.options.decideValue(id, 'APPROVED'); }

  @Permission('options.manage') @Post('admin/options/values/:valueId/reject') @HttpCode(200)
  rejectValue(@Param('valueId', ParseUUIDPipe) id: string, @Body() dto: RejectDto) { return this.options.decideValue(id, 'REJECTED', dto.reason); }
}

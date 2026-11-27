import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Roles, AdminPermission } from '../common/roles.decorator';
import { UploadUrlDto } from './dto/media.dto';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private media: MediaService) {}

  @Roles('SELLER') @Post('upload-url')
  uploadUrl(@CurrentUser() u: AuthUser, @Body() dto: UploadUrlDto) { return this.media.createUpload(u, dto); }

  @Roles('SELLER') @Post(':id/confirm') @HttpCode(200)
  confirm(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.media.confirm(u, id); }

  @Roles('SELLER') @Get() list(@CurrentUser() u: AuthUser) { return this.media.list(u); }

  @Roles('SELLER', 'ADMIN') @AdminPermission('products.view') @Get(':id/url')
  url(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.media.downloadUrl(u, id); }
}

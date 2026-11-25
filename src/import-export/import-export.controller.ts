import {
  BadRequestException, Controller, Get, Header, ParseUUIDPipe, Post, Query, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { ImportExportService } from './import-export.service';

@Controller('import-export')
export class ImportExportController {
  constructor(private svc: ImportExportService) {}

  @Roles('SELLER', 'ADMIN') @Get('template.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="products-template.csv"')
  template() { return this.svc.template(); }

  @Roles('SELLER') @Post('products')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  import(@CurrentUser() u: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Attach a CSV file in the "file" field');
    return this.svc.importProducts(u, file.buffer);
  }

  @Roles('SELLER', 'ADMIN') @Get('products.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="products.csv"')
  export(@CurrentUser() u: AuthUser, @Query('sellerId', new ParseUUIDPipe({ optional: true })) sellerId?: string) {
    return this.svc.exportProducts(u, sellerId);
  }
}

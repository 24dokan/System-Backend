import { Body, Controller, Delete, Get, HttpCode, Put, Query } from '@nestjs/common';
import { Permission } from '../common/roles.decorator';
import { DeleteTranslationDto, SaveTranslationDto, TranslationQuery } from './dto/translations.dto';
import { TranslationsService } from './translations.service';

@Controller('translations')
export class TranslationsController {
  constructor(private tr: TranslationsService) {}

  @Permission('translations.manage') @Get() list(@Query() q: TranslationQuery) { return this.tr.list(q.entityType, q.entityId); }
  @Permission('translations.manage') @Put() save(@Body() dto: SaveTranslationDto) { return this.tr.save(dto); }
  @Permission('translations.manage') @Delete() @HttpCode(200) remove(@Body() dto: DeleteTranslationDto) { return this.tr.remove(dto); }
}

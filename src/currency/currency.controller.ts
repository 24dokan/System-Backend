import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Permission, Roles } from '../common/roles.decorator';
import { SetRateDto } from './dto/currency.dto';
import { CurrencyService } from './currency.service';

@Controller('currencies')
export class CurrencyController {
  constructor(private currencies: CurrencyService) {}

  @Roles('ADMIN') @Get() list() { return this.currencies.list(); }
  @Roles('ADMIN') @Get(':code/rates') history(@Param('code') code: string) { return this.currencies.history(code); }
  @Permission('currency.manage') @Put(':code/rate')
  setRate(@CurrentUser() u: AuthUser, @Param('code') code: string, @Body() dto: SetRateDto) { return this.currencies.setRate(u, code, dto.rateToBase, dto.note); }
}

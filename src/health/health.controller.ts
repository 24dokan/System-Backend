import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/roles.decorator';

@Controller('health')
export class HealthController {
  @Public() @Get()
  check() {
    return { status: 'ok' };
  }
}

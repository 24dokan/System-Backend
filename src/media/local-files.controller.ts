import { BadRequestException, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Put, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Public } from '../common/roles.decorator';
import { LocalStorage } from './local.storage';
import { StorageService } from './storage.service';

/**
 * Only used when STORAGE_DRIVER=local. The links are signed and expire, so these routes need no login:
 * that is what lets an <img> tag and a plain browser upload work, exactly like cloud storage links.
 */
@ApiExcludeController()
@Public()
@Controller('media/local')
export class LocalFilesController {
  private local: LocalStorage | null;

  constructor(storage: StorageService) {
    this.local = storage instanceof LocalStorage ? storage : null;
  }

  private ensureLocal() {
    if (!this.local) throw new NotFoundException();
    return this.local;
  }

  @Put('upload') @HttpCode(200)
  async upload(@Query('key') key: string, @Query('exp') exp: string, @Query('size') size: string, @Query('sig') sig: string, @Req() req: Request) {
    const local = this.ensureLocal();
    if (!local.verify('put', key, Number(exp), Number(size), sig)) throw new ForbiddenException('Upload link is invalid or has expired');
    if ((await local.objectSize(key)) !== null) throw new BadRequestException('This file was already uploaded');
    const ok = await local.write(key, req, Number(size));
    if (!ok) throw new BadRequestException('Uploaded file size does not match what was declared');
    return { ok: true };
  }

  @Get('file')
  async file(@Query('key') key: string, @Query('exp') exp: string, @Query('sig') sig: string, @Res() res: Response) {
    const local = this.ensureLocal();
    if (!local.verify('get', key, Number(exp), 0, sig)) throw new ForbiddenException('Link is invalid or has expired');
    if ((await local.objectSize(key)) === null) throw new NotFoundException();
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(local.pathFor(key)); // also handles Range requests, so video seeking works
  }
}

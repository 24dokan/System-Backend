import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalFilesController } from './local-files.controller';
import { LocalStorage } from './local.storage';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { S3Storage } from './s3.storage';
import { StorageService } from './storage.service';

/** STORAGE_DRIVER picks where files live: "local" (default, a folder on this machine) or "s3" (cloud). */
const storageProvider = {
  provide: StorageService,
  inject: [ConfigService],
  useFactory: (config: ConfigService): StorageService => {
    const driver = config.get('STORAGE_DRIVER', 'local');
    if (driver === 's3') return new S3Storage(config);
    if (driver === 'local') return new LocalStorage(config);
    throw new Error(`Unknown STORAGE_DRIVER "${driver}". Use "local" or "s3".`);
  },
};

@Module({
  controllers: [MediaController, LocalFilesController],
  providers: [MediaService, storageProvider],
  exports: [MediaService],
})
export class MediaModule {}

import { Module } from '@nestjs/common';
import { PackagesModule } from '../packages/packages.module';
import { ImportExportController } from './import-export.controller';
import { ImportExportService } from './import-export.service';

@Module({ imports: [PackagesModule], controllers: [ImportExportController], providers: [ImportExportService] })
export class ImportExportModule {}

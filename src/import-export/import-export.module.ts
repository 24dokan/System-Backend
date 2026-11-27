import { Module } from '@nestjs/common';
import { OptionsModule } from '../options/options.module';
import { PackagesModule } from '../packages/packages.module';
import { ImportExportController } from './import-export.controller';
import { ImportExportService } from './import-export.service';

@Module({ imports: [PackagesModule, OptionsModule], controllers: [ImportExportController], providers: [ImportExportService] })
export class ImportExportModule {}

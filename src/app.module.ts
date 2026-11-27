import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { SellersModule } from './sellers/sellers.module';
import { PackagesModule } from './packages/packages.module';
import { ProductsModule } from './products/products.module';
import { MediaModule } from './media/media.module';
import { ApprovalModule } from './approval/approval.module';
import { ImportExportModule } from './import-export/import-export.module';
import { CatalogModule } from './catalog/catalog.module';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { RolesGuard } from './common/roles.guard';
import { PermissionsModule } from './permissions/permissions.module';
import { PermissionsGuard } from './permissions/permissions.guard';
import { StaffModule } from './staff/staff.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PermissionsModule,
    HealthModule,
    IdentityModule,
    SellersModule,
    CatalogModule,
    PackagesModule,
    ProductsModule,
    MediaModule,
    ApprovalModule,
    ImportExportModule,
    StaffModule,
  ],
  providers: [
    // Order matters: authenticate first, then check roles, then check permissions.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}

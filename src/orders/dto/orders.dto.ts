import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { PageQuery } from '../../common/paging';

export const SOURCES = ['SHOPEE', 'LAZADA', 'TIKTOK', 'STOREFRONT', 'OTHER'] as const;
export const STATUSES = ['TO_PACK', 'PACKED', 'WAITING_PICKUP', 'SHIPPED', 'CANCELLED'] as const;

export class OrderLineDto {
  @IsUUID() skuId: string;
  @IsInt() @Min(1) @Max(10_000) qty: number;
  /** In sen. When left out the variation's current price is used. */
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) unitPriceMinor?: number;
}

export class CreateOrderDto {
  @IsIn(SOURCES) source: (typeof SOURCES)[number];
  @IsOptional() @IsString() @MaxLength(60) externalRef?: string;
  @IsUUID() sellerId: string;
  @IsUUID() warehouseId: string;
  @IsString() @MinLength(1) @MaxLength(120) customerName: string;
  @IsOptional() @IsString() @MaxLength(40) customerPhone?: string;
  @IsString() @MinLength(5) @MaxLength(500) address: string;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) shippingMinor?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) discountMinor?: number;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => OrderLineDto) items: OrderLineDto[];
}

export class OrderQuery extends PageQuery {
  @IsOptional() @IsIn(STATUSES) status?: string;
  @IsOptional() @IsIn(SOURCES) source?: string;
  @IsOptional() @IsUUID() sellerId?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
}

export class CancelDto {
  @IsString() @MinLength(3) @MaxLength(300) reason: string;
}

export class BulkIdsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @IsUUID(undefined, { each: true }) ids: string[];
}

export class ImportQuery {
  @IsUUID() sellerId: string;
  @IsUUID() warehouseId: string;
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) create?: boolean;
}

export class CreateReturnDto {
  @IsUUID() orderItemId: string;
  @IsInt() @Min(1) @Max(10_000) qty: number;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

export class InspectDto {
  @IsEnum({ RESTOCK: 'RESTOCK', DAMAGED: 'DAMAGED', SELLER_CHECK: 'SELLER_CHECK' }) outcome: 'RESTOCK' | 'DAMAGED' | 'SELLER_CHECK';
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class ReturnQuery extends PageQuery {
  @IsOptional() @IsIn(['TO_INSPECT', 'SELLER_CHECK', 'RESTOCKED', 'DAMAGED']) status?: string;
}

export class ReportQuery {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional() @IsUUID() sellerId?: string;
  @IsOptional() @IsIn(SOURCES) source?: string;
}

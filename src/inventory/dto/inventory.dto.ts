import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import { PageQuery } from '../../common/paging';

const bool = ({ value }: { value: unknown }) => value === 'true' || value === true;

export class WarehouseDto {
  @IsString() @Matches(/^[A-Za-z0-9-]{1,10}$/, { message: 'code must be 1 to 10 letters, numbers or dashes' }) code: string;
  @IsString() @MinLength(2) @MaxLength(100) name: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(100) contact?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateWarehouseDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(100) contact?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class StockQuery extends PageQuery {
  @IsOptional() @IsUUID() sellerId?: string;
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsOptional() @Transform(bool) @IsBoolean() low?: boolean;
}

export class MovementQuery extends PageQuery {
  @IsOptional() @IsUUID() sellerId?: string;
  @IsOptional() @IsString() @MaxLength(20) type?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class LevelsQuery {
  @IsUUID() skuId: string;
}

export class SkuSearchQuery {
  @IsOptional() @IsUUID() sellerId?: string;
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
}

export enum AdjustReasonDto { COUNT = 'COUNT', LOST = 'LOST', DAMAGED = 'DAMAGED', EXPIRED = 'EXPIRED', OTHER = 'OTHER' }

export class AdjustDto {
  @IsUUID() skuId: string;
  @IsUUID() warehouseId: string;
  @IsOptional() @IsString() @MaxLength(40) location?: string;
  @IsEnum(AdjustReasonDto) reason: AdjustReasonDto;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) countedQty?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1_000_000) quantity?: number;
  @IsOptional() @IsInt() @Min(-1_000_000) @Max(1_000_000) change?: number;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class AlertLevelDto {
  @IsInt() @Min(0) @Max(100000) lowStockLevel: number;
}

export class SentDto {
  /** Leave out to mark every pending variation as sent. */
  @IsOptional() @IsArray() @ArrayMaxSize(5000) @IsUUID(undefined, { each: true }) skuIds?: string[];
}

class InboundLineDto {
  @IsUUID() skuId: string;
  @IsInt() @Min(1) @Max(1_000_000) expectedQty: number;
}
export class CreateInboundDto {
  @IsUUID() sellerId: string;
  @IsUUID() warehouseId: string;
  @IsDateString() expectedDate: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => InboundLineDto) lines: InboundLineDto[];
}

class ReceiveLineDto {
  @IsUUID() lineId: string;
  @IsInt() @Min(0) @Max(1_000_000) receivedQty: number;
  @IsInt() @Min(0) @Max(1_000_000) damagedQty: number;
  @IsOptional() @IsString() @MaxLength(40) location?: string;
}
export class ReceiveDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ReceiveLineDto) lines: ReceiveLineDto[];
}

export class InboundQuery extends PageQuery {
  @IsOptional() @IsString() @MaxLength(20) status?: string;
}

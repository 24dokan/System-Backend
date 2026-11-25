import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';

export class RejectDto {
  @IsString() @MinLength(3) @MaxLength(1000) reason: string;
}

class SkuChangeDto {
  @IsUUID() skuId: string;
  @IsOptional() @IsInt() @Min(0) priceMinor?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

/** What a seller may change on an approved product. Options and SKU structure are not revisable (stock depends on them). */
export class CreateRevisionDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => SkuChangeDto) skus?: SkuChangeDto[];
}

export class QueueQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize?: number;
}

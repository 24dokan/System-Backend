import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import { ProductStatus } from '@prisma/client';

export class CreateProductDto {
  @IsString() @MinLength(2) @MaxLength(200) name: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsUUID() categoryId: string;
}

export class UpdateProductDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsOptional() @IsUUID() categoryId?: string;
}

class OptionDto {
  @IsString() @MinLength(1) @MaxLength(50) name: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(50, { each: true }) values: string[];
}

export class SetOptionsDto {
  @IsArray() @ArrayMaxSize(5) @ValidateNested({ each: true }) @Type(() => OptionDto) options: OptionDto[];
}

export class GenerateSkusDto {
  /** Price for newly created SKUs, in minor units (sen). */
  @IsInt() @Min(0) priceMinor: number;
  @IsOptional() @IsString() @MaxLength(40) codePrefix?: string;
}

export class UpdateSkuDto {
  @IsOptional() @IsInt() @Min(0) priceMinor?: number;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) code?: string;
  @IsOptional() isActive?: boolean;
}

class FeatureValueDto {
  @IsUUID() featureId: string;
  @IsOptional() @IsString() @MaxLength(200) value?: string;
}

export class SetProductFeaturesDto {
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => FeatureValueDto) features: FeatureValueDto[];
}

export class SetProductMediaDto {
  /** Ordered. The first item is the cover. */
  @IsArray() @ArrayMaxSize(30) @IsUUID('all', { each: true }) mediaIds: string[];
}

export class ListProductsQuery {
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsUUID() sellerId?: string; // Admin only
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

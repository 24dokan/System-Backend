import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class FeatureDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
}

export class CreateCategoryDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100)
  commissionPercent?: number;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
  // Send null to move a category to the top level.
  @IsOptional() @IsUUID() parentId?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100)
  commissionPercent?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateBrandProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @IsOptional() @IsUUID() logoMediaId?: string;
}

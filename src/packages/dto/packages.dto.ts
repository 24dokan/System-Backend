import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import { BillingPeriod } from '@prisma/client';

export class CreatePackageDto {
  @IsString() @MinLength(1) @MaxLength(60) name: string;
  @IsOptional() @IsString() @MaxLength(120) tagline?: string;
  /** Minor units (sen). Omit when isContactUs. */
  @IsOptional() @IsInt() @Min(0) priceMinor?: number;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsEnum(BillingPeriod) billingPeriod?: BillingPeriod;
  @IsOptional() @IsBoolean() isContactUs?: boolean;
  @IsOptional() @IsBoolean() isPopular?: boolean;
  @IsOptional() @IsInt() displayOrder?: number;
  /** null/omitted = unlimited */
  @IsOptional() @IsInt() @Min(0) maxProducts?: number | null;
  /** Defaults to 10 x maxProducts when omitted. null = unlimited */
  @IsOptional() @IsInt() @Min(0) maxSkus?: number | null;
  @IsOptional() @IsInt() @Min(0) maxMicroStores?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) transactionFeePercent?: number;
  @IsOptional() @IsInt() @Min(0) pickupFeeMinor?: number;
}

export class UpdatePackageDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60) name?: string;
  @IsOptional() @IsString() @MaxLength(120) tagline?: string;
  @IsOptional() @IsInt() @Min(0) priceMinor?: number;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsEnum(BillingPeriod) billingPeriod?: BillingPeriod;
  @IsOptional() @IsBoolean() isContactUs?: boolean;
  @IsOptional() @IsBoolean() isPopular?: boolean;
  @IsOptional() @IsInt() displayOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) maxProducts?: number | null;
  @IsOptional() @IsInt() @Min(0) maxSkus?: number | null;
  @IsOptional() @IsInt() @Min(0) maxMicroStores?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) transactionFeePercent?: number;
  @IsOptional() @IsInt() @Min(0) pickupFeeMinor?: number;
}

export class PackageFeatureDto {
  @IsString() @MinLength(1) @MaxLength(160) label: string;
  @IsOptional() @IsString() @MaxLength(60) groupName?: string;
  @IsOptional() @IsInt() displayOrder?: number;
}

class FeatureLinkDto {
  @IsUUID() featureId: string;
  @IsOptional() @IsBoolean() included?: boolean;
  @IsOptional() @IsString() @MaxLength(120) note?: string;
}

export class SetPackageFeaturesDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => FeatureLinkDto) features: FeatureLinkDto[];
}

export class PaymentInstructionDto {
  @IsString() @MinLength(1) bankName: string;
  @IsString() @MinLength(1) accountName: string;
  @IsString() @MinLength(1) accountNumber: string;
  @IsOptional() @IsString() referenceHint?: string;
}

export class SubscribeDto {
  @IsUUID() packageId: string;
}

export class AdminAssignDto {
  @IsUUID() sellerId: string;
  @IsUUID() packageId: string;
}

export class ConfirmPaymentDto {
  @IsInt() @Min(0) amountMinor: number;
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
}

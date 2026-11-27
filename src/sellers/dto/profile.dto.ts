import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { PROFILE_OPTIONS } from '../profile.rules';

const short = 120;
const long = 500;

/** Every field is optional so a seller can save half-finished work. Send null (not an empty string) to clear a field. */
export class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(short) contactFirstName?: string | null;
  @IsOptional() @IsString() @MaxLength(short) contactLastName?: string | null;
  @IsOptional() @IsString() @MaxLength(40) idNumber?: string | null;
  @IsOptional() @IsEmail() contactEmail?: string | null;
  @IsOptional() @IsString() @MaxLength(30) contactPhone?: string | null;

  @IsOptional() @IsString() @MaxLength(200) legalName?: string | null;
  @IsOptional() @IsString() @MaxLength(60) sstNumber?: string | null;
  @IsOptional() @IsIn(PROFILE_OPTIONS.sellerTypes) sellerType?: string | null;
  @IsOptional() @IsString() @MaxLength(long) companyAddress?: string | null;
  @IsOptional() @IsString() @MaxLength(short) country?: string | null;
  @IsOptional() @IsString() @MaxLength(short) state?: string | null;
  @IsOptional() @IsString() @MaxLength(short) city?: string | null;
  @IsOptional() @IsString() @MaxLength(20) postcode?: string | null;
  @IsOptional() @IsBoolean() womanOwned?: boolean | null;
  @IsOptional() @IsBoolean() malaysianOwned?: boolean | null;

  @IsOptional() @IsString() @MaxLength(short) bankName?: string | null;
  @IsOptional() @IsString() @MaxLength(long) bankAddress?: string | null;
  @IsOptional() @IsString() @MaxLength(short) bankAccountName?: string | null;
  @IsOptional() @IsString() @MaxLength(40) bankAccountNumber?: string | null;

  @IsOptional() @IsUrl() @MaxLength(300) storeUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(short) productCategory?: string | null;
  @IsOptional() @IsIn(PROFILE_OPTIONS.productCounts) productCountRange?: string | null;
  @IsOptional() @IsBoolean() stockedInMalaysia?: boolean | null;
  @IsOptional() @IsIn(PROFILE_OPTIONS.cartSystems) cartSystem?: string | null;

  @IsOptional() @IsIn(PROFILE_OPTIONS.titles) techContactTitle?: string | null;
  @IsOptional() @IsString() @MaxLength(short) techContactName?: string | null;
  @IsOptional() @IsEmail() techContactEmail?: string | null;
  @IsOptional() @IsString() @MaxLength(30) techContactMobile?: string | null;

  @IsOptional() @IsString() @MaxLength(60) tinNumber?: string | null;
  @IsOptional() @IsString() @MaxLength(short) einvoiceContactName?: string | null;
  @IsOptional() @IsEmail() einvoiceEmail?: string | null;
}

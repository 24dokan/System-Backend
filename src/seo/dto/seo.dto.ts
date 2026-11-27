import { IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

export class SeoDto {
  @IsOptional() @IsString() @MaxLength(80) slug?: string;
  @IsOptional() @IsString() @MaxLength(200) metaTitle?: string;
  @IsOptional() @IsString() @MaxLength(400) metaDescription?: string;
  /** Send null to remove the share image. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() shareImageMediaId?: string | null;
}

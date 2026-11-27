import { IsIn, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export const ENTITY_FIELDS: Record<string, string[]> = { product: ['name', 'description'], category: ['name'], package: ['name', 'tagline'] };

export class SaveTranslationDto {
  @IsIn(Object.keys(ENTITY_FIELDS)) entityType: string;
  @IsUUID() entityId: string;
  @IsString() @MaxLength(30) field: string;
  @Matches(/^[a-z]{2,3}(-[A-Z]{2})?$/, { message: 'locale must look like ms or zh-CN' }) locale: string;
  @IsString() @MinLength(1) @MaxLength(5000) text: string;
}

export class TranslationQuery {
  @IsIn(Object.keys(ENTITY_FIELDS)) entityType: string;
  @IsUUID() entityId: string;
}

export class DeleteTranslationDto {
  @IsIn(Object.keys(ENTITY_FIELDS)) entityType: string;
  @IsUUID() entityId: string;
  @IsString() @MaxLength(30) field: string;
  @Matches(/^[a-z]{2,3}(-[A-Z]{2})?$/) locale: string;
}

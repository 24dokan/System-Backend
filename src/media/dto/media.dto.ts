import { IsInt, IsString, MaxLength, MinLength } from 'class-validator';

export class UploadUrlDto {
  @IsString() @MinLength(1) @MaxLength(200) filename: string;
  @IsString() mimeType: string;
  @IsInt() sizeBytes: number;
}

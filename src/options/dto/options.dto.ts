import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateOptionDto {
  @IsString() @MinLength(1) @MaxLength(50) name: string;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) @MaxLength(50, { each: true }) values?: string[];
}
export class RenameOptionDto {
  @IsString() @MinLength(1) @MaxLength(50) name: string;
}
export class AddValuesDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsString({ each: true }) @MaxLength(50, { each: true }) values: string[];
}
export class RejectDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

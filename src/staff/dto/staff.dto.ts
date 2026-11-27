import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class RoleDto {
  @IsString() @MinLength(2) @MaxLength(60) name: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) permissions: string[];
}

export class UpdateRoleDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60) name?: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) permissions?: string[];
}

export class CreateStaffDto {
  @IsEmail() email: string;
  @IsString() @MinLength(2) @MaxLength(100) name: string;
  @IsString() @MinLength(10) @MaxLength(100) password: string;
  @IsUUID() staffRoleId: string;
}

export class UpdateStaffDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @IsOptional() @IsUUID() staffRoleId?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class StaffPasswordDto {
  @IsString() @MinLength(10) @MaxLength(100) password: string;
}

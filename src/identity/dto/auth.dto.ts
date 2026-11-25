import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterSellerDto {
  @IsString() @MinLength(2) @MaxLength(100) brandName: string;
  @IsEmail() email: string;
  @IsString() @MinLength(10) @MaxLength(128) password: string;
}

export class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}

export class RefreshDto {
  @IsString() refreshToken: string;
}

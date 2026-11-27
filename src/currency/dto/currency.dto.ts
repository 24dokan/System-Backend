import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SetRateDto {
  /** How many ringgit one unit of the currency is worth. */
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 8 }) @Min(0.00000001) @Max(1_000_000) rateToBase: number;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

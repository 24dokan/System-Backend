import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Max, Min, MinLength } from 'class-validator';
import { PageQuery } from '../../common/paging';

export class CreatePromotionDto {
  @IsUUID() productId: string;
  /** Leave out to cover every variation of the product. */
  @IsOptional() @IsUUID() skuId?: string;
  @IsString() @MinLength(2) @MaxLength(100) name: string;
  @IsIn(['PERCENT', 'FIXED']) type: 'PERCENT' | 'FIXED';
  /** Percent (1 to 90), or an amount off in sen. */
  @Type(() => Number) @IsInt() @Min(1) @Max(100_000_000) value: number;
  @IsDateString() startsAt: string;
  @IsDateString() endsAt: string;
}

export class PromotionQuery extends PageQuery {
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']) status?: string;
}

export class RejectPromotionDto {
  @IsString() @MinLength(3) @MaxLength(300) reason: string;
}

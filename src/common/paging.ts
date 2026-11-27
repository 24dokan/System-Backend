import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Common list query: ?page=1&pageSize=50&search=... */
export class PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize?: number;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
}

export function paging(q: PageQuery) {
  const pageSize = q.pageSize ?? 50;
  const page = q.page ?? 1;
  return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
}

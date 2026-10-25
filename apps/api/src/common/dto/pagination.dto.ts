import { IsOptional, IsInt, Min, Max, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export type SortOrder = 'asc' | 'desc';

export class PaginationDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page (maximum 100)',
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Field to sort results by' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort direction: asc or desc',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc', 'ASC', 'DESC'])
  sortOrder?: SortOrder = 'desc';

  @ApiPropertyOptional({ description: 'Search term for text filtering' })
  @IsOptional()
  @IsString()
  search?: string;

  /**
   * Helper: calculates database skip offset.
   */
  getSkip(): number {
    const p = Math.max(1, this.page ?? 1);
    const l = Math.min(100, Math.max(1, this.limit ?? 10));
    return (p - 1) * l;
  }

  /**
   * Helper: gets sanitized limit (enforcing 100 max).
   */
  getLimit(): number {
    return Math.min(100, Math.max(1, this.limit ?? 10));
  }

  /**
   * Helper: builds Prisma orderBy object strictly against allowed fields.
   */
  getOrderBy<T extends string>(
    allowedFields: readonly T[],
    defaultField: T,
    defaultDirection: SortOrder = 'desc',
  ): Record<string, 'asc' | 'desc'> {
    const direction: 'asc' | 'desc' =
      this.sortOrder?.toLowerCase() === 'asc' ? 'asc' : defaultDirection;

    if (this.sortBy && (allowedFields as readonly string[]).includes(this.sortBy)) {
      return { [this.sortBy]: direction };
    }

    return { [defaultField]: direction };
  }

  /**
   * Helper: standardizes pagination metadata response.
   */
  buildMeta(total: number) {
    const page = Math.max(1, this.page ?? 1);
    const limit = this.getLimit();
    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

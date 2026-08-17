import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const CHILD_SORT_FIELDS = ['name', 'size', 'updatedAt'] as const;
export type ChildSortField = (typeof CHILD_SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export class ListChildrenDto {
  /** Opaque position from the previous page. */
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }): unknown => (typeof value === 'string' ? Number(value) : value))
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;

  @IsOptional()
  @IsIn(CHILD_SORT_FIELDS)
  sort?: ChildSortField;

  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  direction?: SortDirection;

  /** Present when the caller is following a public share link. */
  @IsOptional()
  @IsString()
  token?: string;
}

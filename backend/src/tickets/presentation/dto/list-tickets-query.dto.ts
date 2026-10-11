import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { TicketFilterQueryDto } from './ticket-filter-query.dto';

export const DEFAULT_PAGE_SIZE = 10;

export const MAX_PAGE_SIZE = 100;

export const MAX_PAGE = 1000;

export class ListTicketsQueryDto extends TicketFilterQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit: number = DEFAULT_PAGE_SIZE;
}

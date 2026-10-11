import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Divisi } from '../../../common/enums/divisi.enum';
import { TicketStage } from '../../../generated/prisma/client';
import { EmptyToUndefined } from './empty-to-undefined';

export const SEARCH_MAX_LENGTH = 100;

export const TICKET_ID_CHARACTERS = /^[A-Za-z0-9-]+$/;

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class TicketFilterQueryDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(SEARCH_MAX_LENGTH)
  @Matches(TICKET_ID_CHARACTERS, {
    message: 'search hanya boleh berisi huruf, angka, dan tanda hubung',
  })
  search?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsEnum(TicketStage)
  status?: TicketStage;

  @EmptyToUndefined()
  @IsOptional()
  @IsEnum(Divisi)
  divisi?: Divisi;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(CALENDAR_DATE, { message: 'dateFrom harus berformat YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'dateFrom bukan tanggal yang valid' })
  dateFrom?: string;

  @EmptyToUndefined()
  @IsOptional()
  @Matches(CALENDAR_DATE, { message: 'dateTo harus berformat YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'dateTo bukan tanggal yang valid' })
  dateTo?: string;
}

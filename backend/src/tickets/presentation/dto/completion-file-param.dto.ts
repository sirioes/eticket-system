import { IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import {
  SEARCH_MAX_LENGTH,
  TICKET_ID_CHARACTERS,
} from './ticket-filter-query.dto';

export class CompletionFileParamDto {
  @IsString()
  @MaxLength(SEARCH_MAX_LENGTH)
  @Matches(TICKET_ID_CHARACTERS, {
    message: 'id pengaduan hanya boleh berisi huruf, angka, dan tanda hubung',
  })
  ticketId!: string;

  @IsUUID()
  fileId!: string;
}

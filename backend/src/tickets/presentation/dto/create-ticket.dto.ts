import { IsEnum, IsString, MaxLength } from 'class-validator';
import { Divisi } from '../../../common/enums/divisi.enum';
import { DESCRIPTION_LENGTH_MESSAGE } from '../../application/use-cases/create-ticket.use-case';
import { DESCRIPTION_MAX_LENGTH } from '../../domain/ticket-rules';

export class CreateTicketDto {
  @IsEnum(Divisi)
  toDivisi!: Divisi;

  @IsString()
  @MaxLength(DESCRIPTION_MAX_LENGTH * 2, {
    message: DESCRIPTION_LENGTH_MESSAGE,
  })
  description!: string;
}

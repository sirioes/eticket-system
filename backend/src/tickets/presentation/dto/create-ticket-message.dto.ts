import { IsString, MaxLength } from 'class-validator';
import { COMMENT_LENGTH_MESSAGE } from '../../application/use-cases/post-ticket-comment.use-case';
import { COMMENT_MAX_LENGTH } from '../../domain/ticket-message-rules';

export class CreateTicketMessageDto {
  @IsString()
  @MaxLength(COMMENT_MAX_LENGTH * 2, { message: COMMENT_LENGTH_MESSAGE })
  body!: string;
}

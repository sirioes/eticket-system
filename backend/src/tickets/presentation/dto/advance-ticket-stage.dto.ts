import { IsIn, IsString, MaxLength, ValidateIf } from 'class-validator';
import { REASON_LENGTH_MESSAGE } from '../../application/use-cases/advance-ticket-stage.use-case';
import { REASON_MAX_LENGTH } from '../../domain/ticket-message-rules';
import { STAGE_ACTIONS } from '../../domain/ticket-stage-flow';
import type { StageAction } from '../../domain/ticket-stage-flow';

export class AdvanceTicketStageDto {
  @IsIn(STAGE_ACTIONS)
  action!: StageAction;

  @ValidateIf((_dto, value) => value !== undefined)
  @IsString()
  @MaxLength(REASON_MAX_LENGTH * 2, { message: REASON_LENGTH_MESSAGE })
  reason?: string;
}

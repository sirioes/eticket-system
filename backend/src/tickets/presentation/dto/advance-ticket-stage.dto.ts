import { IsIn } from 'class-validator';
import { STAGE_ACTIONS } from '../../domain/ticket-stage-flow';
import type { StageAction } from '../../domain/ticket-stage-flow';

export class AdvanceTicketStageDto {
  @IsIn(STAGE_ACTIONS)
  action!: StageAction;
}

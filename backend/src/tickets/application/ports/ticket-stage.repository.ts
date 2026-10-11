import { TicketStage } from '../../../generated/prisma/client';
import type { StageAction } from '../../domain/ticket-stage-flow';

export interface AdvanceStageCommand {
  readonly ticketId: string;
  readonly expectedStage: TicketStage;
  readonly action: StageAction;
  readonly nextStage: TicketStage;
  readonly actorId: number;
}

export abstract class TicketStageRepository {
  abstract advanceStage(command: AdvanceStageCommand): Promise<boolean>;
}
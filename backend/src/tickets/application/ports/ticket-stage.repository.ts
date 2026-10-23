import { TicketStage } from '../../../generated/prisma/client';
import type { StageAction } from '../../domain/ticket-stage-flow';

export interface NewCompletionFile {
  readonly fileName: string;
  readonly storedName: string;
  readonly mimeType: string;
  readonly size: number;
}

export interface AdvanceStageCommand {
  readonly ticketId: string;
  readonly expectedStage: TicketStage;
  readonly action: StageAction;
  readonly nextStage: TicketStage;
  readonly actorId: number;
  readonly reason: string | null;
  readonly completionFiles?: readonly NewCompletionFile[];
}

export abstract class TicketStageRepository {
  abstract advanceStage(command: AdvanceStageCommand): Promise<boolean>;
}

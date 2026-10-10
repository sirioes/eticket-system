import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../../../auth/domain/auth-user';
import { TicketStage } from '../../../generated/prisma/client';
import { TICKET_NOT_FOUND_MESSAGE } from '../../attachments/application/use-cases/upload-attachment.use-case';
import {
  isAuthorizedActor,
  resolveNextStage,
  StageAction,
} from '../../domain/ticket-stage-flow';
import { canViewTicket } from '../../domain/ticket-visibility';
import { TicketQueryRepository } from '../ports/ticket-query.repository';
import { TicketStageRepository } from '../ports/ticket-stage.repository';

export const NOT_AUTHORIZED_ACTOR_MESSAGE =
  'Anda tidak berwenang melakukan aksi ini pada pengaduan ini';

export const ACTION_NOT_AVAILABLE_MESSAGE =
  'Aksi ini tidak tersedia untuk tahap pengaduan saat ini';

export const STAGE_CHANGED_MESSAGE =
  'Status pengaduan baru saja berubah, muat ulang halaman';

export interface AdvanceTicketStageCommand {
  readonly actor: AuthUser;
  readonly ticketId: string;
  readonly action: StageAction;
}

export interface AdvancedTicket {
  readonly id: string;
  readonly stage: TicketStage;
}

@Injectable()
export class AdvanceTicketStageUseCase {
  constructor(
    private readonly queries: TicketQueryRepository,
    private readonly stages: TicketStageRepository,
  ) {}

  async execute(command: AdvanceTicketStageCommand): Promise<AdvancedTicket> {
    const { actor, ticketId, action } = command;

    const ticket = await this.queries.findVisibilityById(ticketId);
    if (ticket === null || !canViewTicket(actor, ticket)) {
      throw new NotFoundException(TICKET_NOT_FOUND_MESSAGE);
    }
    if (!isAuthorizedActor(actor, ticket)) {
      throw new ForbiddenException(NOT_AUTHORIZED_ACTOR_MESSAGE);
    }

    const nextStage = resolveNextStage(ticket.stage, action);
    if (nextStage === null) {
      throw new ConflictException(ACTION_NOT_AVAILABLE_MESSAGE);
    }

    const advanced = await this.stages.advanceStage({
      ticketId,
      expectedStage: ticket.stage,
      action,
      nextStage,
      actorId: actor.id,
    });
    if (!advanced) {
      throw new ConflictException(STAGE_CHANGED_MESSAGE);
    }

    return { id: ticketId, stage: nextStage };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../../../auth/domain/auth-user';
import { Divisi } from '../../../common/enums/divisi.enum';
import { TicketLogAction, TicketStage } from '../../../generated/prisma/client';
import { TICKET_NOT_FOUND_MESSAGE } from '../../attachments/application/use-cases/upload-attachment.use-case';
import {
  canReceiveAttachments,
  MAX_ATTACHMENTS_PER_TICKET,
} from '../../attachments/domain/attachment-rules';
import {
  isAuthorizedActor,
  resolveNextStage,
  STAGE_ACTIONS,
  StageAction,
} from '../../domain/ticket-stage-flow';
import { canViewTicket } from '../../domain/ticket-visibility';
import {
  TicketAttachmentSummary,
  TicketQueryRepository,
} from '../ports/ticket-query.repository';

export interface GetTicketByIdQuery {
  readonly user: AuthUser;
  readonly ticketId: string;
}

export interface TicketPersonView {
  readonly fullName: string;
  readonly divisi: `${Divisi}` | null;
}

export interface TicketTimelineEntryView {
  readonly action: TicketLogAction;
  readonly fromStage: TicketStage | null;
  readonly toStage: TicketStage;
  readonly createdAt: Date;
  readonly actor: TicketPersonView;
}

export interface TicketDetailView {
  readonly id: string;
  readonly description: string;
  readonly stage: TicketStage;
  readonly rejectedAtStage: TicketStage | null;
  readonly fromDivisi: `${Divisi}`;
  readonly toDivisi: `${Divisi}`;
  readonly createdAt: Date;
  readonly createdBy: TicketPersonView;
  readonly attachments: TicketAttachmentSummary[];
  readonly timeline: TicketTimelineEntryView[];
  readonly isCreator: boolean;
  readonly availableActions: StageAction[];
  readonly canUploadAttachment: boolean;
}

@Injectable()
export class GetTicketByIdUseCase {
  constructor(private readonly tickets: TicketQueryRepository) {}

  async execute(query: GetTicketByIdQuery): Promise<TicketDetailView> {
    const { user } = query;
    const ticket = await this.tickets.findDetailById(query.ticketId);
    if (ticket === null || !canViewTicket(user, ticket)) {
      throw new NotFoundException(TICKET_NOT_FOUND_MESSAGE);
    }

    const isCreator = ticket.createdById === user.id;
    const availableActions = isAuthorizedActor(user, ticket)
      ? STAGE_ACTIONS.filter(
          (action) => resolveNextStage(ticket.stage, action) !== null,
        )
      : [];

    return {
      id: ticket.id,
      description: ticket.description,
      stage: ticket.stage,
      rejectedAtStage: ticket.rejectedAtStage,
      fromDivisi: ticket.fromDivisi,
      toDivisi: ticket.toDivisi,
      createdAt: ticket.createdAt,
      createdBy: {
        fullName: ticket.createdBy.fullName,
        divisi: ticket.createdBy.divisi,
      },
      attachments: ticket.attachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        size: attachment.size,
      })),
      timeline: ticket.timeline.map((entry) => ({
        action: entry.action,
        fromStage: entry.fromStage,
        toStage: entry.toStage,
        createdAt: entry.createdAt,
        actor: {
          fullName: entry.actor.fullName,
          divisi: entry.actor.divisi,
        },
      })),
      isCreator,
      availableActions,
      canUploadAttachment:
        isCreator &&
        canReceiveAttachments(ticket.stage) &&
        ticket.attachments.length < MAX_ATTACHMENTS_PER_TICKET,
    };
  }
}

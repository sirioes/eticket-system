import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../../../auth/domain/auth-user';
import { TICKET_NOT_FOUND_MESSAGE } from '../../attachments/application/use-cases/upload-attachment.use-case';
import {
  DIVISI_LABEL,
  historyActionLabel,
  stageStatusLabel,
} from '../../domain/ticket-export-labels';
import { canReadComments } from '../../domain/ticket-message-rules';
import { canViewTicket } from '../../domain/ticket-visibility';
import { TicketDetailExportWriter } from '../ports/ticket-detail-export-writer';
import { TicketDetailExportRepository } from '../ports/ticket-detail-export.repository';
import { TicketExportFile } from './export-outgoing-tickets.use-case';

export interface ExportTicketDetailQuery {
  readonly user: AuthUser;
  readonly ticketId: string;
}

@Injectable()
export class ExportTicketDetailUseCase {
  constructor(
    private readonly tickets: TicketDetailExportRepository,
    private readonly writer: TicketDetailExportWriter,
  ) {}

  async execute(query: ExportTicketDetailQuery): Promise<TicketExportFile> {
    const { user } = query;
    const visibility = await this.tickets.findVisibility(query.ticketId);
    if (visibility === null || !canViewTicket(user, visibility)) {
      throw new NotFoundException(TICKET_NOT_FOUND_MESSAGE);
    }

    const includeReason = canReadComments(user, visibility);
    const ticket = await this.tickets.findById(query.ticketId, includeReason);
    if (ticket === null) throw new NotFoundException(TICKET_NOT_FOUND_MESSAGE);

    const content = await this.writer.write({
      information: {
        id: ticket.id,
        fromDivisi: DIVISI_LABEL[ticket.fromDivisi],
        toDivisi: DIVISI_LABEL[ticket.toDivisi],
        createdBy: ticket.createdBy.fullName,
        createdAt: ticket.createdAt,
        status: stageStatusLabel(ticket),
        description: ticket.description,
      },
      history: ticket.history.map((entry) => ({
        action: historyActionLabel(entry, ticket),
        actor: entry.actor.fullName,
        divisi:
          entry.actor.divisi === null ? null : DIVISI_LABEL[entry.actor.divisi],
        createdAt: entry.createdAt,
        reason: includeReason ? entry.reason : null,
      })),
      includeReason,
    });

    return { fileName: `${ticket.id}.xlsx`, content };
  }
}

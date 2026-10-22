import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../../../auth/domain/auth-user';
import { Divisi } from '../../../common/enums/divisi.enum';
import { TICKET_NOT_FOUND_MESSAGE } from '../../attachments/application/use-cases/upload-attachment.use-case';
import {
  canReadComments,
  reasonLabel,
  ReasonLabel,
} from '../../domain/ticket-message-rules';
import {
  TicketMessageKind,
  TicketMessageRecord,
  TicketMessageRepository,
} from '../ports/ticket-message.repository';
import { TicketQueryRepository } from '../ports/ticket-query.repository';

export interface TicketMessageView {
  readonly id: string;
  readonly kind: TicketMessageKind;
  readonly reasonLabel: ReasonLabel | null;
  readonly body: string;
  readonly createdAt: Date;
  readonly author: {
    readonly fullName: string;
    readonly divisi: `${Divisi}` | null;
  };
}

export function toMessageView(record: TicketMessageRecord): TicketMessageView {
  return {
    id: record.id,
    kind: record.kind,
    reasonLabel: record.stageLog
      ? reasonLabel(record.stageLog.action, record.stageLog.fromStage)
      : null,
    body: record.body,
    createdAt: record.createdAt,
    author: {
      fullName: record.author.fullName,
      divisi: record.author.divisi,
    },
  };
}

export interface ListTicketMessagesQuery {
  readonly user: AuthUser;
  readonly ticketId: string;
}

@Injectable()
export class ListTicketMessagesUseCase {
  constructor(
    private readonly tickets: TicketQueryRepository,
    private readonly messages: TicketMessageRepository,
  ) {}

  async execute(query: ListTicketMessagesQuery): Promise<TicketMessageView[]> {
    const ticket = await this.tickets.findVisibilityById(query.ticketId);
    if (ticket === null || !canReadComments(query.user, ticket)) {
      throw new NotFoundException(TICKET_NOT_FOUND_MESSAGE);
    }

    const records = await this.messages.listByTicket(query.ticketId);
    return records.map(toMessageView);
  }
}

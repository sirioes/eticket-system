import { Divisi } from '../../../common/enums/divisi.enum';
import { TicketLogAction, TicketStage } from '../../../generated/prisma/client';

export type TicketMessageKind = 'KOMENTAR' | 'ALASAN';

export interface TicketMessageRecord {
  readonly id: string;
  readonly kind: TicketMessageKind;
  readonly body: string;
  readonly createdAt: Date;
  readonly author: {
    readonly fullName: string;
    readonly divisi: `${Divisi}` | null;
  };
  readonly stageLog: {
    readonly action: TicketLogAction;
    readonly fromStage: TicketStage | null;
  } | null;
}

export interface CreateCommentCommand {
  readonly ticketId: string;
  readonly authorId: number;
  readonly body: string;
  readonly limit: number;
}

export class MessageContentionError extends Error {
  constructor() {
    super('Menunggu kunci pengaduan terlalu lama');
    this.name = 'MessageContentionError';
  }
}

export abstract class TicketMessageRepository {
  abstract listByTicket(ticketId: string): Promise<TicketMessageRecord[]>;

  abstract createComment(
    command: CreateCommentCommand,
  ): Promise<TicketMessageRecord | null>;
}

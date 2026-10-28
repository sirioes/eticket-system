import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCommentCommand,
  MessageContentionError,
  TicketMessageRecord,
  TicketMessageRepository,
} from '../application/ports/ticket-message.repository';

const CONTENTION_ERROR_CODES: readonly string[] = ['P2028', 'P2034'];

const TRANSACTION_OPTIONS = {
  maxWait: 5_000,
  timeout: 10_000,
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
} as const;

const MESSAGE_SELECT = {
  id: true,
  kind: true,
  body: true,
  createdAt: true,
  author: { select: { fullName: true, divisi: true } },
  stageLog: { select: { action: true, fromStage: true } },
} as const satisfies Prisma.TicketMessageSelect;

@Injectable()
export class PrismaTicketMessageRepository implements TicketMessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByTicket(ticketId: string): Promise<TicketMessageRecord[]> {
    return this.prisma.ticketMessage.findMany({
      where: { ticketId },
      select: MESSAGE_SELECT,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async createComment(
    command: CreateCommentCommand,
  ): Promise<TicketMessageRecord | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM Ticket WHERE id = ${command.ticketId} FOR UPDATE`;

        const total = await tx.ticketMessage.count({
          where: { ticketId: command.ticketId },
        });
        if (total >= command.limit) return null;

        return tx.ticketMessage.create({
          data: {
            ticketId: command.ticketId,
            authorId: command.authorId,
            kind: 'KOMENTAR',
            body: command.body,
          },
          select: MESSAGE_SELECT,
        });
      }, TRANSACTION_OPTIONS);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        CONTENTION_ERROR_CODES.includes(error.code)
      ) {
        throw new MessageContentionError();
      }
      throw error;
    }
  }
}

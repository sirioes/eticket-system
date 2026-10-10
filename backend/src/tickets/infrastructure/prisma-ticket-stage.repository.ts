import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdvanceStageCommand,
  TicketStageRepository,
} from '../application/ports/ticket-stage.repository';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

const TRANSACTION_OPTIONS = {
  maxWait: 5_000,
  timeout: 10_000,
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
} as const;

@Injectable()
export class PrismaTicketStageRepository implements TicketStageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async advanceStage(command: AdvanceStageCommand): Promise<boolean> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.ticket.updateMany({
          where: { id: command.ticketId, stage: command.expectedStage },
          data: {
            stage: command.nextStage,
            ...(command.action === 'TOLAK' && {
              rejectedAtStage: command.expectedStage,
              rejectedById: command.actorId,
            }),
          },
        });
        if (count === 0) return false;

        await tx.ticketStageLog.create({
          data: {
            ticketId: command.ticketId,
            action: command.action,
            fromStage: command.expectedStage,
            toStage: command.nextStage,
            actorId: command.actorId,
          },
          select: { id: true },
        });
        return true;
      }, TRANSACTION_OPTIONS);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        return false;
      }
      throw error;
    }
  }
}
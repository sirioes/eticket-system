import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DuplicateTicketIdError,
  NewTicket,
  TicketRepository,
} from '../application/ports/ticket.repository';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class PrismaTicketRepository implements TicketRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findLatestIdWithPrefix(prefix: string): Promise<string | null> {
    const latest = await this.prisma.ticket.findFirst({
      where: { id: { startsWith: prefix } },
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    return latest?.id ?? null;
  }

  async insert(ticket: NewTicket): Promise<void> {
    try {
      await this.prisma.ticket.create({
        data: {
          id: ticket.id,
          description: ticket.description,
          fromDivisi: ticket.fromDivisi,
          toDivisi: ticket.toDivisi,
          createdById: ticket.createdById,
        },
        select: { id: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new DuplicateTicketIdError(ticket.id);
      }
      throw error;
    }
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { VisibleTicket } from '../domain/ticket-visibility';
import {
  TicketDetailExportRepository,
  TicketExportSource,
} from '../application/ports/ticket-detail-export.repository';

const ACTOR_SELECT = { fullName: true, divisi: true } as const;

const VISIBILITY_SELECT = {
  fromDivisi: true,
  toDivisi: true,
  stage: true,
  rejectedAtStage: true,
} as const satisfies Prisma.TicketSelect;

const exportSelect = (includeReason: boolean) =>
  ({
    id: true,
    description: true,
    ...VISIBILITY_SELECT,
    createdAt: true,
    createdBy: { select: ACTOR_SELECT },
    stageLogs: {
      select: {
        action: true,
        fromStage: true,
        createdAt: true,
        actor: { select: ACTOR_SELECT },
        ...(includeReason && { message: { select: { body: true } } }),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    },
  }) satisfies Prisma.TicketSelect;

@Injectable()
export class PrismaTicketDetailExportRepository implements TicketDetailExportRepository {
  constructor(private readonly prisma: PrismaService) {}

  findVisibility(id: string): Promise<VisibleTicket | null> {
    return this.prisma.ticket.findUnique({
      where: { id },
      select: VISIBILITY_SELECT,
    });
  }

  async findById(
    id: string,
    includeReason: boolean,
  ): Promise<TicketExportSource | null> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: exportSelect(includeReason),
    });
    if (ticket === null) return null;

    const { stageLogs, ...rest } = ticket;
    return {
      ...rest,
      history: stageLogs.map(({ message, ...entry }) => ({
        ...entry,
        reason: message?.body ?? null,
      })),
    };
  }
}

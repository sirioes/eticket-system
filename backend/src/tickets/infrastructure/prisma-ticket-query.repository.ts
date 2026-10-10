import { Injectable } from '@nestjs/common';
import { Divisi } from '../../common/enums/divisi.enum';
import { Prisma, TicketStage } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IncomingScope,
  OutgoingScope,
  Pagination,
  TicketDetail,
  TicketExportRow,
  TicketListFilter,
  TicketPage,
  TicketQueryRepository,
} from '../application/ports/ticket-query.repository';
import type { VisibleTicket } from '../domain/ticket-visibility';
import { buildIncomingWhere, buildOutgoingWhere } from './ticket-list-where';

const NEWEST_FIRST = [{ createdAt: 'desc' }, { id: 'desc' }] as const;

const ACTOR_SELECT = { fullName: true, divisi: true } as const;

const LIST_SELECT = {
  id: true,
  description: true,
  stage: true,
  fromDivisi: true,
  toDivisi: true,
  createdAt: true,
  _count: { select: { attachments: true } },
} as const satisfies Prisma.TicketSelect;

const DETAIL_SELECT = {
  id: true,
  description: true,
  stage: true,
  fromDivisi: true,
  toDivisi: true,
  rejectedAtStage: true,
  createdAt: true,
  createdById: true,
  createdBy: { select: ACTOR_SELECT },
  attachments: {
    select: { id: true, fileName: true, mimeType: true, size: true },
    orderBy: { createdAt: 'asc' },
  },
  stageLogs: {
    select: {
      action: true,
      fromStage: true,
      toStage: true,
      createdAt: true,
      actor: { select: ACTOR_SELECT },
    },
    orderBy: { createdAt: 'asc' },
  },
} as const satisfies Prisma.TicketSelect;

@Injectable()
export class PrismaTicketQueryRepository implements TicketQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDetailById(id: string): Promise<TicketDetail | null> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: DETAIL_SELECT,
    });
    if (ticket === null) return null;

    const { stageLogs, ...rest } = ticket;
    return { ...rest, timeline: stageLogs };
  }

  findVisibilityById(id: string): Promise<VisibleTicket | null> {
    return this.prisma.ticket.findUnique({
      where: { id },
      select: {
        fromDivisi: true,
        toDivisi: true,
        stage: true,
        rejectedAtStage: true,
      },
    });
  }

  listOutgoing(
    scope: OutgoingScope,
    filter: TicketListFilter,
    pagination: Pagination,
  ): Promise<TicketPage> {
    return this.findPage(buildOutgoingWhere(scope, filter), pagination);
  }

  listIncoming(
    scope: IncomingScope,
    filter: TicketListFilter,
    pagination: Pagination,
  ): Promise<TicketPage> {
    return this.findPage(buildIncomingWhere(scope, filter), pagination);
  }

  countOutgoingInStages(
    fromDivisi: Divisi,
    stages: readonly TicketStage[],
  ): Promise<number> {
    return this.prisma.ticket.count({
      where: { fromDivisi, stage: { in: [...stages] } },
    });
  }

  countIncomingInStages(
    toDivisi: Divisi,
    stages: readonly TicketStage[],
  ): Promise<number> {
    return this.prisma.ticket.count({
      where: { toDivisi, stage: { in: [...stages] } },
    });
  }

  async findOutgoingForExport(
    scope: OutgoingScope,
    filter: TicketListFilter,
    limit: number,
  ): Promise<TicketExportRow[]> {
    const tickets = await this.prisma.ticket.findMany({
      where: buildOutgoingWhere(scope, filter),
      orderBy: [...NEWEST_FIRST],
      take: limit,
      select: {
        id: true,
        fromDivisi: true,
        toDivisi: true,
        stageLogs: {
          where: { action: { in: ['PROSES', 'SELESAI'] } },
          select: { action: true, createdAt: true },
        },
      },
    });

    return tickets.map(({ stageLogs, ...ticket }) => ({
      ...ticket,
      processedAt:
        stageLogs.find((log) => log.action === 'PROSES')?.createdAt ?? null,
      completedAt:
        stageLogs.find((log) => log.action === 'SELESAI')?.createdAt ?? null,
    }));
  }

  private async findPage(
    where: Prisma.TicketWhereInput,
    { page, limit }: Pagination,
  ): Promise<TicketPage> {
    const [tickets, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        orderBy: [...NEWEST_FIRST],
        skip: (page - 1) * limit,
        take: limit,
        select: LIST_SELECT,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      items: tickets.map(({ _count, ...ticket }) => ({
        ...ticket,
        attachmentCount: _count.attachments,
      })),
      total,
    };
  }
}
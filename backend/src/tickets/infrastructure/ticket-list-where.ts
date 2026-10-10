import { Prisma, TicketStage } from '../../generated/prisma/client';
import { Role } from '../../common/enums/role.enum';
import type {
  IncomingScope,
  OutgoingScope,
  TicketListFilter,
} from '../application/ports/ticket-query.repository';
import { STAGE_TRANSITIONS } from '../domain/ticket-stage-flow';
import { canViewAsDestination } from '../domain/ticket-visibility';

const ALL_STAGES = Object.values(TicketStage);

const REJECTABLE_STAGES = ALL_STAGES.filter(
  (stage) => STAGE_TRANSITIONS[stage].TOLAK !== undefined,
);

function filterClauses(
  filter: TicketListFilter,
  counterpartField: 'fromDivisi' | 'toDivisi',
): Prisma.TicketWhereInput[] {
  const clauses: Prisma.TicketWhereInput[] = [];

  if (filter.search !== undefined) {
    clauses.push({ id: { contains: filter.search } });
  }
  if (filter.stage !== undefined) {
    clauses.push({ stage: filter.stage });
  }
  if (filter.counterpartDivisi !== undefined) {
    clauses.push(
      counterpartField === 'toDivisi'
        ? { toDivisi: filter.counterpartDivisi }
        : { fromDivisi: filter.counterpartDivisi },
    );
  }
  if (filter.createdFrom !== undefined || filter.createdBefore !== undefined) {
    clauses.push({
      createdAt: {
        ...(filter.createdFrom !== undefined && { gte: filter.createdFrom }),
        ...(filter.createdBefore !== undefined && { lt: filter.createdBefore }),
      },
    });
  }

  return clauses;
}

function destinationVisibility(role: Role): Prisma.TicketWhereInput {
  const openStages = ALL_STAGES.filter(
    (stage) => stage !== 'DITOLAK' && canViewAsDestination(role, stage, null),
  );
  const visibleRejectionOrigins = REJECTABLE_STAGES.filter((origin) =>
    canViewAsDestination(role, 'DITOLAK', origin),
  );

  const rejectionClauses: Prisma.TicketWhereInput[] = [];
  if (visibleRejectionOrigins.length > 0) {
    rejectionClauses.push({
      rejectedAtStage: { in: visibleRejectionOrigins },
    });
  }
  if (canViewAsDestination(role, 'DITOLAK', null)) {
    rejectionClauses.push({ rejectedAtStage: null });
  }

  const visible: Prisma.TicketWhereInput[] = [{ stage: { in: openStages } }];
  if (rejectionClauses.length > 0) {
    visible.push({ stage: 'DITOLAK', OR: rejectionClauses });
  }
  return { OR: visible };
}

export function buildOutgoingWhere(
  scope: OutgoingScope,
  filter: TicketListFilter,
): Prisma.TicketWhereInput {
  return {
    AND: [
      { fromDivisi: scope.fromDivisi },
      ...filterClauses(filter, 'toDivisi'),
    ],
  };
}

export function buildIncomingWhere(
  scope: IncomingScope,
  filter: TicketListFilter,
): Prisma.TicketWhereInput {
  return {
    AND: [
      { toDivisi: scope.viewer.divisi },
      destinationVisibility(scope.viewer.role),
      ...filterClauses(filter, 'fromDivisi'),
    ],
  };
}
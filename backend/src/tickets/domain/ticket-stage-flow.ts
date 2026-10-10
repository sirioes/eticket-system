import { TicketStage } from '../../generated/prisma/client';
import type { AuthUser } from '../../auth/domain/auth-user';
import { Divisi } from '../../common/enums/divisi.enum';
import { isManagerRole, Role } from '../../common/enums/role.enum';
import type { VisibleTicket } from './ticket-visibility';

export const STAGE_ACTIONS = ['TERIMA', 'TOLAK', 'PROSES', 'SELESAI'] as const;

export type StageAction = (typeof STAGE_ACTIONS)[number];

export const STAGE_TRANSITIONS: Record<
  TicketStage,
  Partial<Record<StageAction, TicketStage>>
> = {
  MENUNGGU_MANAGER_ASAL: {
    TERIMA: 'MENUNGGU_MANAGER_TUJUAN',
    TOLAK: 'DITOLAK',
  },
  MENUNGGU_MANAGER_TUJUAN: {
    TERIMA: 'MENUNGGU_STAF_TUJUAN',
    TOLAK: 'DITOLAK',
  },
  MENUNGGU_STAF_TUJUAN: {
    PROSES: 'DIPROSES',
  },
  DIPROSES: {
    SELESAI: 'SELESAI',
  },
  SELESAI: {},
  DITOLAK: {},
};

export type ActableTicket = Pick<
  VisibleTicket,
  'fromDivisi' | 'toDivisi' | 'stage'
>;

export function resolveNextStage(
  stage: TicketStage,
  action: StageAction,
): TicketStage | null {
  return STAGE_TRANSITIONS[stage][action] ?? null;
}

export function isAuthorizedActor(
  user: Pick<AuthUser, 'role' | 'divisi'>,
  ticket: ActableTicket,
): boolean {
  if (user.role === Role.SUPERADMIN || user.divisi === null) return false;

  switch (ticket.stage) {
    case 'MENUNGGU_MANAGER_ASAL':
      return isManagerRole(user.role) && user.divisi === ticket.fromDivisi;
    case 'MENUNGGU_MANAGER_TUJUAN':
      return isManagerRole(user.role) && user.divisi === ticket.toDivisi;
    case 'MENUNGGU_STAF_TUJUAN':
    case 'DIPROSES':
      return !isManagerRole(user.role) && user.divisi === ticket.toDivisi;
    default:
      return false;
  }
}

const ALL_STAGES = Object.values(TicketStage);

export interface ActionableStages {
  readonly outgoing: TicketStage[];
  readonly incoming: TicketStage[];
}

export function actionableStages(user: {
  readonly role: Role;
  readonly divisi: Divisi;
}): ActionableStages {
  const otherDivisi = user.divisi === Divisi.IT ? Divisi.FINANCE : Divisi.IT;

  return {
    outgoing: ALL_STAGES.filter((stage) =>
      isAuthorizedActor(user, {
        fromDivisi: user.divisi,
        toDivisi: otherDivisi,
        stage,
      }),
    ),
    incoming: ALL_STAGES.filter((stage) =>
      isAuthorizedActor(user, {
        fromDivisi: otherDivisi,
        toDivisi: user.divisi,
        stage,
      }),
    ),
  };
}

import type { TicketStage } from '../../generated/prisma/client';
import type { AuthUser } from '../../auth/domain/auth-user';
import { isManagerRole, Role } from '../../common/enums/role.enum';
import type { StageAction } from './ticket-stage-flow';
import { canViewTicket } from './ticket-visibility';
import type { VisibleTicket } from './ticket-visibility';

export const REASON_MIN_LENGTH = 10;

export const REASON_MAX_LENGTH = 500;

export const COMMENT_MIN_LENGTH = 1;

export const COMMENT_MAX_LENGTH = 1000;

export const MAX_MESSAGES_PER_TICKET = 100;

const REASON_ACTIONS: readonly StageAction[] = ['TERIMA', 'TOLAK'];

const COMMENTABLE_STAGES: readonly TicketStage[] = [
  'MENUNGGU_MANAGER_TUJUAN',
  'MENUNGGU_STAF_TUJUAN',
  'DIPROSES',
];

export type ReasonLabel = 'PENGAJUAN' | 'MENERIMA' | 'MENOLAK';

export function requiresReason(action: StageAction): boolean {
  return REASON_ACTIONS.includes(action);
}

export function isReasonLengthValid(reason: string): boolean {
  const length = [...reason].length;
  return length >= REASON_MIN_LENGTH && length <= REASON_MAX_LENGTH;
}

export function isCommentLengthValid(comment: string): boolean {
  const length = [...comment].length;
  return length >= COMMENT_MIN_LENGTH && length <= COMMENT_MAX_LENGTH;
}

function isManagerOfEitherDivisi(
  user: Pick<AuthUser, 'role' | 'divisi'>,
  ticket: VisibleTicket,
): boolean {
  return (
    isManagerRole(user.role) &&
    user.divisi !== null &&
    (user.divisi === ticket.fromDivisi || user.divisi === ticket.toDivisi)
  );
}

export function canReadComments(
  user: Pick<AuthUser, 'role' | 'divisi'>,
  ticket: VisibleTicket,
): boolean {
  if (!canViewTicket(user, ticket)) return false;
  return user.role === Role.SUPERADMIN || isManagerOfEitherDivisi(user, ticket);
}

export function canWriteComments(
  user: Pick<AuthUser, 'role' | 'divisi'>,
  ticket: VisibleTicket,
): boolean {
  return (
    isManagerOfEitherDivisi(user, ticket) &&
    COMMENTABLE_STAGES.includes(ticket.stage)
  );
}

export function reasonLabel(
  action: string,
  fromStage: TicketStage | null,
): ReasonLabel | null {
  if (action === 'TOLAK') return 'MENOLAK';
  if (action !== 'TERIMA') return null;
  if (fromStage === 'MENUNGGU_MANAGER_ASAL') return 'PENGAJUAN';
  if (fromStage === 'MENUNGGU_MANAGER_TUJUAN') return 'MENERIMA';
  return null;
}

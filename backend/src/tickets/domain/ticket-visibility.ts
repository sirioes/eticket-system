import { TicketStage } from '../../generated/prisma/client';
import type { AuthUser } from '../../auth/domain/auth-user';
import { Divisi } from '../../common/enums/divisi.enum';
import { isManagerRole, Role } from '../../common/enums/role.enum';

export interface VisibleTicket {
  readonly fromDivisi: `${Divisi}`;
  readonly toDivisi: `${Divisi}`;
  readonly stage: TicketStage;
  readonly rejectedAtStage: TicketStage | null;
}

export function canViewTicket(
  user: Pick<AuthUser, 'role' | 'divisi'>,
  ticket: VisibleTicket,
): boolean {
  if (user.role === Role.SUPERADMIN) return true;
  if (user.divisi === null) return false;
  if (user.divisi === ticket.fromDivisi) return true;
  if (user.divisi !== ticket.toDivisi) return false;

  switch (ticket.stage) {
    case 'MENUNGGU_MANAGER_ASAL':
      return false;
    case 'DITOLAK':
      return ticket.rejectedAtStage !== 'MENUNGGU_MANAGER_ASAL';
    case 'MENUNGGU_MANAGER_TUJUAN':
      return isManagerRole(user.role);
    default:
      return true;
  }
}

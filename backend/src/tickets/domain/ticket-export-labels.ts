import { Divisi } from '../../common/enums/divisi.enum';
import { TicketLogAction, TicketStage } from '../../generated/prisma/client';
import type { VisibleTicket } from './ticket-visibility';

export const DIVISI_LABEL: Record<`${Divisi}`, string> = {
  IT: 'IT',
  FINANCE: 'Finance',
  TAX: 'Pajak',
  YOUTUBE: 'YouTube',
  DIGITAL_MARKETING: 'Digital Marketing',
  DESIGN: 'Design',
  PROJECT: 'Project',
  LEGAL: 'Legal',
  SO: 'SO',
  HR: 'HR',
};

const STAGE_LABEL: Record<TicketStage, string> = {
  MENUNGGU_MANAGER_ASAL: 'Menunggu Manajer Divisi Asal',
  MENUNGGU_MANAGER_TUJUAN: 'Menunggu Manajer Divisi Tujuan',
  MENUNGGU_STAF_TUJUAN: 'Diterima',
  DIPROSES: 'Diproses',
  SELESAI: 'Selesai',
  DITOLAK: 'Ditolak',
};

type LabelledTicket = Pick<VisibleTicket, 'fromDivisi' | 'toDivisi'>;

export function stageStatusLabel(
  ticket: LabelledTicket & Pick<VisibleTicket, 'stage'>,
): string {
  switch (ticket.stage) {
    case 'MENUNGGU_MANAGER_ASAL':
      return `Menunggu Manajer Divisi ${DIVISI_LABEL[ticket.fromDivisi]}`;
    case 'MENUNGGU_MANAGER_TUJUAN':
      return `Menunggu Manajer Divisi ${DIVISI_LABEL[ticket.toDivisi]}`;
    default:
      return STAGE_LABEL[ticket.stage];
  }
}

export function historyActionLabel(
  entry: { action: TicketLogAction; fromStage: TicketStage | null },
  ticket: LabelledTicket,
): string {
  const atOrigin = entry.fromStage === 'MENUNGGU_MANAGER_ASAL';
  const managerDivisi =
    DIVISI_LABEL[atOrigin ? ticket.fromDivisi : ticket.toDivisi];

  switch (entry.action) {
    case 'DIBUAT':
      return 'Dibuat';
    case 'TERIMA':
      return atOrigin
        ? `Disetujui Manajer Divisi ${managerDivisi}`
        : `Diterima Manajer Divisi ${managerDivisi}`;
    case 'TOLAK':
      return `Ditolak Manajer Divisi ${managerDivisi}`;
    case 'PROSES':
      return 'Mulai diproses';
    case 'SELESAI':
      return 'Diselesaikan';
  }
}

import { TicketStage } from '../../generated/prisma/client';
import { Divisi } from '../../common/enums/divisi.enum';

export type StageAction = 'TERIMA' | 'TOLAK' | 'PROSES' | 'SELESAI';

export const STAGE_TRANSITIONS: Record<TicketStage, Partial<Record<StageAction, TicketStage>>> = {
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

export function toDisplayStatus(
  stage: TicketStage,
  ticket: { fromDivisi: Divisi; toDivisi: Divisi },
): string {
  switch (stage) {
    case 'MENUNGGU_MANAGER_ASAL':
      return `Menunggu Manajer Divisi ${ticket.fromDivisi}`;
    case 'MENUNGGU_MANAGER_TUJUAN':
      return `Menunggu Manajer Divisi ${ticket.toDivisi}`;
    case 'MENUNGGU_STAF_TUJUAN':
      return 'Diterima';
    case 'DIPROSES':
      return 'Diproses';
    case 'SELESAI':
      return 'Selesai';
    case 'DITOLAK':
      return 'Ditolak';
  }
}
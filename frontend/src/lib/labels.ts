import type { Divisi } from '@/types/auth.types';
import type { StageAction, TicketStage } from '@/types/ticket.types';

export const DIVISI_LABEL: Record<Divisi, string> = {
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

export function formatDateWita(date: string | Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Makassar',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}
export const STAGE_FILTER_LABEL: Record<TicketStage, string> = {
  MENUNGGU_MANAGER_ASAL: 'Menunggu Manajer Divisi Asal',
  MENUNGGU_MANAGER_TUJUAN: 'Menunggu Manajer Divisi Tujuan',
  MENUNGGU_STAF_TUJUAN: 'Diterima',
  DIPROSES: 'Diproses',
  SELESAI: 'Selesai',
  DITOLAK: 'Ditolak',
};

export function stageLabel(ticket: {
  stage: TicketStage;
  fromDivisi: Divisi;
  toDivisi: Divisi;
}): string {
  switch (ticket.stage) {
    case 'MENUNGGU_MANAGER_ASAL':
      return `Menunggu Manajer Divisi ${DIVISI_LABEL[ticket.fromDivisi]}`;
    case 'MENUNGGU_MANAGER_TUJUAN':
      return `Menunggu Manajer Divisi ${DIVISI_LABEL[ticket.toDivisi]}`;
    default:
      return STAGE_FILTER_LABEL[ticket.stage];
  }
}

export const STAGE_ACTION_LABEL: Record<StageAction, string> = {
  TERIMA: 'Terima',
  TOLAK: 'Tolak',
  PROSES: 'Proses',
  SELESAI: 'Selesai',
};

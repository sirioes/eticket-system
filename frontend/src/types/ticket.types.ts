import type { Divisi } from '@/types/auth.types';

export type TicketStage =
  | 'MENUNGGU_MANAGER_ASAL' | 'MENUNGGU_MANAGER_TUJUAN'
  | 'MENUNGGU_STAF_TUJUAN' | 'DIPROSES' | 'SELESAI' | 'DITOLAK';

export type StageAction = 'TERIMA' | 'TOLAK' | 'PROSES' | 'SELESAI';

export type TicketLogAction = 'DIBUAT' | StageAction;

export interface TicketListFilters {
  search?: string;
  status?: TicketStage;
  divisi?: Divisi;
  dateFrom?: string;
  dateTo?: string;
}

export interface TicketListQuery extends TicketListFilters {
  page?: number;
  limit?: number;
}

export interface TicketListItem {
  id: string;
  descriptionPreview: string;
  stage: TicketStage;
  fromDivisi: Divisi;
  toDivisi: Divisi;
  createdAt: string;
  attachmentCount: number;
}

export interface TicketList {
  items: TicketListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ActionCounts {
  outgoing: number;
  incoming: number;
}

export interface TicketStats {
  total: number;
  incoming: number;
  outgoing: number;
  selesai: number;
}

export interface TicketPerson {
  fullName: string;
  divisi: Divisi | null;
}

export interface TicketAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface TicketTimelineEntry {
  action: TicketLogAction;
  fromStage: TicketStage | null;
  toStage: TicketStage;
  createdAt: string;
  actor: TicketPerson;
}

export interface TicketDetail {
  id: string;
  description: string;
  stage: TicketStage;
  rejectedAtStage: TicketStage | null;
  fromDivisi: Divisi;
  toDivisi: Divisi;
  createdAt: string;
  createdBy: TicketPerson;
  attachments: TicketAttachment[];
  timeline: TicketTimelineEntry[];
  isCreator: boolean;
  availableActions: StageAction[];
  canUploadAttachment: boolean;
}

export interface AdvancedTicket {
  id: string;
  stage: TicketStage;
}

export interface CreateTicketInput {
  toDivisi: Divisi;
  description: string;
}

export interface CreatedTicket {
  id: string;
}

export type UploadedAttachment = TicketAttachment;

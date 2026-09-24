export type TicketStage =
  | 'MENUNGGU_MANAGER_ASAL' | 'MENUNGGU_MANAGER_TUJUAN'
  | 'MENUNGGU_STAF_TUJUAN' | 'DIPROSES' | 'SELESAI' | 'DITOLAK';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface TicketStats {
  outgoing: number;
  incoming: number;
  selesai: number;
  total: number;
}

export interface TicketListParams {
  page?: number;
  search?: string;
  status?: TicketStage;
}
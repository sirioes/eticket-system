import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';
import { TicketLogAction, TicketStage } from '../../../generated/prisma/client';
import type { VisibleTicket } from '../../domain/ticket-visibility';

export interface TicketListFilter {
  readonly search?: string;
  readonly stage?: TicketStage;
  readonly counterpartDivisi?: Divisi;
  readonly createdFrom?: Date;
  readonly createdBefore?: Date;
}

export interface Pagination {
  readonly page: number;
  readonly limit: number;
}

export interface OutgoingScope {
  readonly fromDivisi: Divisi;
}

export interface IncomingScope {
  readonly viewer: { readonly role: Role; readonly divisi: Divisi };
}

export interface TicketListItem {
  readonly id: string;
  readonly description: string;
  readonly stage: TicketStage;
  readonly fromDivisi: `${Divisi}`;
  readonly toDivisi: `${Divisi}`;
  readonly createdAt: Date;
  readonly attachmentCount: number;
}

export interface TicketPage {
  readonly items: TicketListItem[];
  readonly total: number;
}

export interface TicketActor {
  readonly fullName: string;
  readonly divisi: `${Divisi}` | null;
}

export interface TicketTimelineEntry {
  readonly action: TicketLogAction;
  readonly fromStage: TicketStage | null;
  readonly toStage: TicketStage;
  readonly createdAt: Date;
  readonly actor: TicketActor;
}

export interface TicketAttachmentSummary {
  readonly id: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly size: number;
}

export interface TicketDetail extends VisibleTicket {
  readonly id: string;
  readonly description: string;
  readonly createdAt: Date;
  readonly createdById: number;
  readonly createdBy: TicketActor;
  readonly attachments: TicketAttachmentSummary[];
  readonly timeline: TicketTimelineEntry[];
}

export interface TicketExportRow {
  readonly id: string;
  readonly fromDivisi: `${Divisi}`;
  readonly toDivisi: `${Divisi}`;
  readonly processedAt: Date | null;
  readonly completedAt: Date | null;
}

export abstract class TicketQueryRepository {
  abstract findDetailById(id: string): Promise<TicketDetail | null>;

  abstract findVisibilityById(id: string): Promise<VisibleTicket | null>;

  abstract listOutgoing(
    scope: OutgoingScope,
    filter: TicketListFilter,
    pagination: Pagination,
  ): Promise<TicketPage>;

  abstract listIncoming(
    scope: IncomingScope,
    filter: TicketListFilter,
    pagination: Pagination,
  ): Promise<TicketPage>;

  abstract countOutgoingInStages(
    fromDivisi: Divisi,
    stages: readonly TicketStage[],
  ): Promise<number>;

  abstract countIncomingInStages(
    toDivisi: Divisi,
    stages: readonly TicketStage[],
  ): Promise<number>;

  abstract findOutgoingForExport(
    scope: OutgoingScope,
    filter: TicketListFilter,
    limit: number,
  ): Promise<TicketExportRow[]>;
}
import { TicketLogAction, TicketStage } from '../../../generated/prisma/client';
import type { VisibleTicket } from '../../domain/ticket-visibility';
import type { TicketActor } from './ticket-query.repository';

export interface TicketExportHistoryEntry {
  readonly action: TicketLogAction;
  readonly fromStage: TicketStage | null;
  readonly createdAt: Date;
  readonly actor: TicketActor;
  readonly reason: string | null;
}

export interface TicketExportSource extends VisibleTicket {
  readonly id: string;
  readonly description: string;
  readonly createdAt: Date;
  readonly createdBy: TicketActor;
  readonly history: TicketExportHistoryEntry[];
}

export abstract class TicketDetailExportRepository {
  abstract findVisibility(id: string): Promise<VisibleTicket | null>;

  abstract findById(
    id: string,
    includeReason: boolean,
  ): Promise<TicketExportSource | null>;
}

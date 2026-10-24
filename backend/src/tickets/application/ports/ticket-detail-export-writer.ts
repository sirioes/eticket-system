export interface TicketDetailExportInformation {
  readonly id: string;
  readonly fromDivisi: string;
  readonly toDivisi: string;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly status: string;
  readonly description: string;
}

export interface TicketDetailExportHistoryRow {
  readonly action: string;
  readonly actor: string;
  readonly divisi: string | null;
  readonly createdAt: Date;
  readonly reason: string | null;
}

export interface TicketDetailExport {
  readonly information: TicketDetailExportInformation;
  readonly history: readonly TicketDetailExportHistoryRow[];
  readonly includeReason: boolean;
}

export abstract class TicketDetailExportWriter {
  abstract write(data: TicketDetailExport): Promise<Buffer>;
}

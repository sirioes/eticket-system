import { TicketExportRow } from './ticket-query.repository';

export abstract class TicketExportWriter {
  abstract write(rows: readonly TicketExportRow[]): Promise<Buffer>;
}

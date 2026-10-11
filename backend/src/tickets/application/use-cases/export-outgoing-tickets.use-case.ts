import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Divisi } from '../../../common/enums/divisi.enum';
import { toWitaWallClock } from '../../domain/wita-date-range';
import { TicketExportWriter } from '../ports/ticket-export-writer';
import { TicketQueryRepository } from '../ports/ticket-query.repository';
import {
  requireDivisi,
  TicketListQuery,
  toTicketListFilter,
} from './ticket-list-query';

export const EXPORT_ROW_LIMIT = 5000;

export const EXPORT_TOO_LARGE_MESSAGE = `Hasil export lebih dari ${EXPORT_ROW_LIMIT} baris, persempit filter terlebih dahulu`;

export type ExportOutgoingTicketsQuery = Omit<TicketListQuery, 'page' | 'limit'>;

export interface TicketExportFile {
  readonly fileName: string;
  readonly content: Buffer;
}

export function exportFileName(divisi: Divisi, at: Date): string {
  const stamp = toWitaWallClock(at)
    .toISOString()
    .slice(0, 16)
    .replace(/[-:]/g, '')
    .replace('T', '-');
  return `pengaduan-keluar-${divisi}-${stamp}.xlsx`;
}

@Injectable()
export class ExportOutgoingTicketsUseCase {
  constructor(
    private readonly tickets: TicketQueryRepository,
    private readonly writer: TicketExportWriter,
  ) {}

  async execute(query: ExportOutgoingTicketsQuery): Promise<TicketExportFile> {
    const fromDivisi = requireDivisi(query.user);
    const filter = toTicketListFilter(query);
    const rows = await this.tickets.findOutgoingForExport(
      { fromDivisi },
      filter,
      EXPORT_ROW_LIMIT + 1,
    );
    if (rows.length > EXPORT_ROW_LIMIT) {
      throw new UnprocessableEntityException(EXPORT_TOO_LARGE_MESSAGE);
    }

    return {
      fileName: exportFileName(fromDivisi, new Date()),
      content: await this.writer.write(rows),
    };
  }
}

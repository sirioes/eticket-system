import { Injectable } from '@nestjs/common';
import writeXlsxFile, { type Row } from 'write-excel-file/node';
import { TicketExportWriter } from '../application/ports/ticket-export-writer';
import { TicketExportRow } from '../application/ports/ticket-query.repository';
import { toWitaWallClock } from '../domain/wita-date-range';

export const EXPORT_SHEET_NAME = 'Pengaduan Keluar';

export const EXPORT_HEADERS = [
  'ID Pengaduan',
  'Divisi Asal',
  'Divisi Tujuan',
  'Waktu Diproses (WITA)',
  'Waktu Selesai (WITA)',
] as const;

const EXPORT_DATE_FORMAT = 'yyyy-mm-dd hh:mm';

const COLUMN_WIDTHS = [22, 20, 20, 22, 22];

function textCell(value: string) {
  return { value, type: String };
}

function timeCell(value: Date | null) {
  if (value === null) return null;
  return {
    value: toWitaWallClock(value),
    type: Date,
    format: EXPORT_DATE_FORMAT,
  };
}

@Injectable()
export class XlsxTicketExportWriter extends TicketExportWriter {
  async write(rows: readonly TicketExportRow[]): Promise<Buffer> {
    const header: Row = EXPORT_HEADERS.map((title) => ({
      value: title,
      type: String,
      fontWeight: 'bold' as const,
    }));
    const body: Row[] = rows.map((row) => [
      textCell(row.id),
      textCell(row.fromDivisi),
      textCell(row.toDivisi),
      timeCell(row.processedAt),
      timeCell(row.completedAt),
    ]);

    return writeXlsxFile([header, ...body], {
      sheet: EXPORT_SHEET_NAME,
      columns: COLUMN_WIDTHS.map((width) => ({ width })),
      stickyRowsCount: 1,
    }).toBuffer();
  }
}

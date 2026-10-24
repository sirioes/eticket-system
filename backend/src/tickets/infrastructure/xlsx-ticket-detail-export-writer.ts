import { Injectable } from '@nestjs/common';
import writeXlsxFile, { type Row } from 'write-excel-file/node';
import {
  TicketDetailExport,
  TicketDetailExportInformation,
  TicketDetailExportWriter,
} from '../application/ports/ticket-detail-export-writer';
import { toWitaWallClock } from '../domain/wita-date-range';

export const INFORMATION_SHEET_NAME = 'Informasi';

export const HISTORY_SHEET_NAME = 'Riwayat';

export const INFORMATION_LABELS = [
  'ID Pengaduan',
  'Divisi Asal',
  'Divisi Tujuan',
  'Dibuat Oleh',
  'Tanggal Dibuat (WITA)',
  'Status',
  'Keterangan',
] as const;

export const HISTORY_HEADERS = [
  'Tahap/Aksi',
  'Aktor',
  'Divisi',
  'Waktu (WITA)',
] as const;

export const REASON_HEADER = 'Alasan';

const EXPORT_DATE_FORMAT = 'yyyy-mm-dd hh:mm';

const INFORMATION_COLUMN_WIDTHS = [24, 70];

const HISTORY_COLUMN_WIDTHS = [36, 28, 20, 22];

const REASON_COLUMN_WIDTH = 70;

function textCell(value: string | null, wrap = false) {
  if (value === null || value === '') return null;
  return { value, type: String, wrap, alignVertical: 'top' as const };
}

function timeCell(value: Date) {
  return {
    value: toWitaWallClock(value),
    type: Date,
    format: EXPORT_DATE_FORMAT,
    alignVertical: 'top' as const,
  };
}

function boldCell(value: string) {
  return {
    value,
    type: String,
    fontWeight: 'bold' as const,
    alignVertical: 'top' as const,
  };
}

function informationRows(information: TicketDetailExportInformation): Row[] {
  const [id, from, to, creator, created, status, description] =
    INFORMATION_LABELS;
  return [
    [boldCell(id), textCell(information.id)],
    [boldCell(from), textCell(information.fromDivisi)],
    [boldCell(to), textCell(information.toDivisi)],
    [boldCell(creator), textCell(information.createdBy)],
    [boldCell(created), timeCell(information.createdAt)],
    [boldCell(status), textCell(information.status)],
    [boldCell(description), textCell(information.description, true)],
  ];
}

function historyRows(data: TicketDetailExport): Row[] {
  const titles = data.includeReason
    ? [...HISTORY_HEADERS, REASON_HEADER]
    : [...HISTORY_HEADERS];
  const header: Row = titles.map((title) => ({
    value: title,
    type: String,
    fontWeight: 'bold' as const,
  }));
  const body: Row[] = data.history.map((entry) => {
    const row: Row = [
      textCell(entry.action),
      textCell(entry.actor),
      textCell(entry.divisi),
      timeCell(entry.createdAt),
    ];
    if (data.includeReason) row.push(textCell(entry.reason, true));
    return row;
  });
  return [header, ...body];
}

@Injectable()
export class XlsxTicketDetailExportWriter extends TicketDetailExportWriter {
  async write(data: TicketDetailExport): Promise<Buffer> {
    const historyWidths = data.includeReason
      ? [...HISTORY_COLUMN_WIDTHS, REASON_COLUMN_WIDTH]
      : HISTORY_COLUMN_WIDTHS;

    return writeXlsxFile([
      {
        data: informationRows(data.information),
        sheet: INFORMATION_SHEET_NAME,
        columns: INFORMATION_COLUMN_WIDTHS.map((width) => ({ width })),
      },
      {
        data: historyRows(data),
        sheet: HISTORY_SHEET_NAME,
        columns: historyWidths.map((width) => ({ width })),
        stickyRowsCount: 1,
      },
    ]).toBuffer();
  }
}

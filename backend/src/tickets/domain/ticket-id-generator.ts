import { Divisi } from '../../common/enums/divisi.enum';
import { toDivisiCode } from '../../common/enums/divisi-code';

const MAX_DAILY_SEQUENCE = 999;

const SEQUENCE_PATTERN = /^\d{3}$/;

export class TicketNumberLimitExceededException extends Error {
  constructor(divisi: Divisi, dateStr: string) {
    super(`Batas ${MAX_DAILY_SEQUENCE} tiket per hari terlampaui untuk divisi ${divisi} pada ${dateStr}`);
  }
}

export function ticketIdPrefix(divisi: Divisi, dateWita: string): string {
  return `${toDivisiCode(divisi)}-${dateWita}-`;
}

export function nextSequence(prefix: string, latestId: string | null): number {
  if (latestId === null) return 1;
  const suffix = latestId.slice(prefix.length);
  if (!latestId.startsWith(prefix) || !SEQUENCE_PATTERN.test(suffix)) {
    throw new Error(`Format ID tiket tidak dikenal: ${latestId}`);
  }
  return Number(suffix) + 1;
}

export function generateTicketId(divisi: Divisi, dateWita: string, sequenceToday: number): string {
  if (sequenceToday > MAX_DAILY_SEQUENCE) {
    throw new TicketNumberLimitExceededException(divisi, dateWita);
  }
  return `${ticketIdPrefix(divisi, dateWita)}${String(sequenceToday).padStart(3, '0')}`;
}

export function getTodayDateWita(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Makassar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now).replace(/-/g, '');
}
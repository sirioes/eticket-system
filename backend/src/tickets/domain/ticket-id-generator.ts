import { Divisi } from '../../common/enums/divisi.enum';
import { toDivisiCode } from '../../common/enums/divisi-code';

export class TicketNumberLimitExceededException extends Error {
  constructor(divisi: Divisi, dateStr: string) {
    super(`Batas 999 tiket per hari terlampaui untuk divisi ${divisi} pada ${dateStr}`);
  }
}

export function generateTicketId(divisi: Divisi, dateWita: string, sequenceToday: number): string {
  if (sequenceToday > 999) {
    throw new TicketNumberLimitExceededException(divisi, dateWita);
  }
  const kode = toDivisiCode(divisi);
  const nnn = String(sequenceToday).padStart(3, '0');
  return `${kode}-${dateWita}-${nnn}`;
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
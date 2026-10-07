import {
  generateTicketId,
  getTodayDateWita,
  TicketNumberLimitExceededException,
  nextSequence,
  ticketIdPrefix
} from './ticket-id-generator';
import { Divisi } from '../../common/enums/divisi.enum';

describe('generateTicketId', () => {
  it('format benar dan urutan bertambah', () => {
    expect(generateTicketId(Divisi.IT, '20260921', 1)).toBe('IT-20260921-001');
    expect(generateTicketId(Divisi.TAX, '20260921', 42)).toBe('TAX-20260921-042');
  });

  it('melempar error di atas 999', () => {
    expect(() => generateTicketId(Divisi.IT, '20260921', 1000)).toThrow(
      TicketNumberLimitExceededException,
    );
  });

  it('reset harian: divisi & tanggal berbeda tidak saling pengaruh', () => {
    expect(generateTicketId(Divisi.IT, '20260921', 1)).not.toBe(
      generateTicketId(Divisi.IT, '20260922', 1),
    );
  });

  it('perhitungan tanggal WITA benar di sekitar tengah malam', () => {
    const nearMidnightUtc = new Date('2026-09-20T23:30:00Z');
    expect(getTodayDateWita(nearMidnightUtc)).toBe('20260921');
  });
});


describe('ticketIdPrefix & nextSequence', () => {
  const prefix = ticketIdPrefix(Divisi.FINANCE, '20261006');

  it('prefix memakai kode divisi dan tanggal', () => {
    expect(prefix).toBe('FIN-20261006-');
  });

  it('mulai dari 1 kalau belum ada tiket hari itu', () => {
    expect(nextSequence(prefix, null)).toBe(1);
  });

  it('melanjutkan dari ID terakhir', () => {
    expect(nextSequence(prefix, 'FIN-20261006-041')).toBe(42);
  });

  it('menolak ID dengan format tidak dikenal', () => {
    expect(() => nextSequence(prefix, 'FIN-20261006-XYZ')).toThrow();
    expect(() => nextSequence(prefix, 'IT-20261006-001')).toThrow();
  });
});
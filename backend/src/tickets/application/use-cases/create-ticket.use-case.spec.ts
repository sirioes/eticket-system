import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthUser } from '../../../auth/domain/auth-user';
import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';
import {
  DuplicateTicketIdError,
  TicketRepository,
} from '../ports/ticket.repository';
import {
  CREATOR_WITHOUT_DIVISI_MESSAGE,
  CreateTicketUseCase,
  DAILY_LIMIT_MESSAGE,
  DESCRIPTION_INVALID_CHARACTER_MESSAGE,
  DESCRIPTION_LENGTH_MESSAGE,
  SAME_DIVISI_MESSAGE,
  TICKET_ID_BUSY_MESSAGE,
} from './create-ticket.use-case';

const staffIt: AuthUser = {
  id: 11,
  fullName: 'Ayu Lestari IT01',
  role: Role.TEAM_MAIN_OFFICE,
  divisi: Divisi.IT,
  isActive: true,
  passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
};

const superadmin: AuthUser = {
  ...staffIt,
  id: 1,
  role: Role.SUPERADMIN,
  divisi: null,
};

const VALID_DESCRIPTION = 'Printer lantai 2 tidak bisa mencetak';

describe('CreateTicketUseCase', () => {
  const tickets = { findLatestIdWithPrefix: jest.fn(), insert: jest.fn() };
  const useCase = new CreateTicketUseCase(
    tickets as unknown as TicketRepository,
  );

  const create = (
    overrides: Partial<{
      creator: AuthUser;
      toDivisi: Divisi;
      description: string;
    }> = {},
  ) =>
    useCase.execute({
      creator: staffIt,
      toDivisi: Divisi.FINANCE,
      description: VALID_DESCRIPTION,
      ...overrides,
    });

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers({
      now: new Date('2026-10-05T16:30:00Z'),
      doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
    });
    tickets.findLatestIdWithPrefix.mockResolvedValue(null);
    tickets.insert.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('membuat tiket pertama hari itu dengan tanggal WITA dan nomor 001', async () => {
    await expect(create()).resolves.toEqual({ id: 'IT-20261006-001' });
    expect(tickets.findLatestIdWithPrefix).toHaveBeenCalledWith('IT-20261006-');
    expect(tickets.insert).toHaveBeenCalledWith({
      id: 'IT-20261006-001',
      description: VALID_DESCRIPTION,
      fromDivisi: Divisi.IT,
      toDivisi: Divisi.FINANCE,
      createdById: 11,
    });
  });

  it('melanjutkan nomor urut dari tiket terakhir', async () => {
    tickets.findLatestIdWithPrefix.mockResolvedValue('IT-20261006-007');
    await expect(create()).resolves.toEqual({ id: 'IT-20261006-008' });
  });

  it('memangkas spasi di awal dan akhir keterangan', async () => {
    await create({ description: `   ${VALID_DESCRIPTION}  \n` });
    expect(tickets.insert).toHaveBeenCalledWith(
      expect.objectContaining({ description: VALID_DESCRIPTION }),
    );
  });

  it('menolak akun tanpa divisi', async () => {
    await expect(create({ creator: superadmin })).rejects.toThrow(
      new ForbiddenException(CREATOR_WITHOUT_DIVISI_MESSAGE),
    );
    expect(tickets.insert).not.toHaveBeenCalled();
  });

  it('menolak divisi tujuan yang sama dengan divisi pengirim', async () => {
    await expect(create({ toDivisi: Divisi.IT })).rejects.toThrow(
      new BadRequestException(SAME_DIVISI_MESSAGE),
    );
    expect(tickets.insert).not.toHaveBeenCalled();
  });

  it.each([
    ['3 karakter', 'abc'],
    ['3000 karakter', 'a'.repeat(3000)],
    ['hanya spasi', ' '.repeat(50)],
    ['9 karakter setelah dipangkas', `    ${'a'.repeat(9)}    `],
  ])('menolak keterangan %s', async (_label, description) => {
    await expect(create({ description })).rejects.toThrow(
      new BadRequestException(DESCRIPTION_LENGTH_MESSAGE),
    );
    expect(tickets.insert).not.toHaveBeenCalled();
  });

  it.each([
    ['surrogate yang rusak', `${VALID_DESCRIPTION}\uD83D`],
    ['zero width space sebagai isi', '\u200B'.repeat(40)],
    ['zero width non joiner sebagai isi', '\u200C'.repeat(40)],
    ['mongolian vowel separator sebagai isi', '\u180E'.repeat(40)],
    ['right to left override di tengah', 'Printer \u202Erusak parah sekali'],
    ['control character NUL', `Printer\u0000 rusak lantai 2 gedung A`],
  ])('menolak keterangan dengan %s', async (_label, description) => {
    await expect(create({ description })).rejects.toThrow(
      new BadRequestException(DESCRIPTION_INVALID_CHARACTER_MESSAGE),
    );
    expect(tickets.insert).not.toHaveBeenCalled();
  });

  it('menerima keterangan multi baris dan menyeragamkan akhir baris Windows', async () => {
    await create({
      description: 'Printer lantai 2 rusak\r\nTolong dicek hari ini',
    });
    expect(tickets.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Printer lantai 2 rusak\nTolong dicek hari ini',
      }),
    );
  });

  it('mengulang dengan nomor baru saat ID bentrok dengan submit lain', async () => {
    tickets.findLatestIdWithPrefix
      .mockResolvedValueOnce('IT-20261006-001')
      .mockResolvedValueOnce('IT-20261006-002');
    tickets.insert.mockRejectedValueOnce(
      new DuplicateTicketIdError('IT-20261006-002'),
    );

    await expect(create()).resolves.toEqual({ id: 'IT-20261006-003' });
    expect(tickets.insert).toHaveBeenCalledTimes(2);
  });

  it('menyerah setelah 3 kali bentrok', async () => {
    tickets.insert.mockRejectedValue(
      new DuplicateTicketIdError('IT-20261006-001'),
    );

    await expect(create()).rejects.toThrow(
      new ConflictException(TICKET_ID_BUSY_MESSAGE),
    );
    expect(tickets.insert).toHaveBeenCalledTimes(3);
  });

  it('tidak mengulang untuk error selain bentrok ID', async () => {
    tickets.insert.mockRejectedValue(new Error('koneksi putus'));

    await expect(create()).rejects.toThrow('koneksi putus');
    expect(tickets.insert).toHaveBeenCalledTimes(1);
  });

  it('menolak saat nomor harian sudah 999', async () => {
    tickets.findLatestIdWithPrefix.mockResolvedValue('IT-20261006-999');

    await expect(create()).rejects.toThrow(
      new ConflictException(DAILY_LIMIT_MESSAGE),
    );
    expect(tickets.insert).not.toHaveBeenCalled();
  });
});

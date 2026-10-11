import {
  BadRequestException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuthUser } from '../../../auth/domain/auth-user';
import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';
import { TicketExportWriter } from '../ports/ticket-export-writer';
import {
  TicketExportRow,
  TicketQueryRepository,
} from '../ports/ticket-query.repository';
import {
  EXPORT_ROW_LIMIT,
  EXPORT_TOO_LARGE_MESSAGE,
  exportFileName,
  ExportOutgoingTicketsUseCase,
} from './export-outgoing-tickets.use-case';
import { USER_WITHOUT_DIVISI_MESSAGE } from './ticket-list-query';

const user = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 1,
  fullName: 'Staf IT IT01',
  role: Role.TEAM_MAIN_OFFICE,
  divisi: Divisi.IT,
  isActive: true,
  passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const rows = (count: number): TicketExportRow[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `IT-${index}`,
    fromDivisi: Divisi.IT,
    toDivisi: Divisi.TAX,
    processedAt: null,
    completedAt: null,
  }));

describe('ExportOutgoingTicketsUseCase', () => {
  let findOutgoingForExport: jest.Mock;
  let write: jest.Mock;
  let useCase: ExportOutgoingTicketsUseCase;

  beforeEach(() => {
    findOutgoingForExport = jest.fn().mockResolvedValue(rows(2));
    write = jest.fn().mockResolvedValue(Buffer.from('xlsx'));
    useCase = new ExportOutgoingTicketsUseCase(
      { findOutgoingForExport } as unknown as TicketQueryRepository,
      { write } as unknown as TicketExportWriter,
    );
    jest.useFakeTimers().setSystemTime(new Date('2026-10-10T04:05:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('mengambil tiket keluar milik divisi sesi dengan filter aktif', async () => {
    await useCase.execute({
      user: user(),
      search: 'IT-2026',
      status: 'SELESAI',
      divisi: Divisi.TAX,
      dateFrom: '2026-10-01',
      dateTo: '2026-10-10',
    });

    expect(findOutgoingForExport).toHaveBeenCalledWith(
      { fromDivisi: Divisi.IT },
      {
        search: 'IT-2026',
        stage: 'SELESAI',
        counterpartDivisi: Divisi.TAX,
        createdFrom: new Date('2026-09-30T16:00:00.000Z'),
        createdBefore: new Date('2026-10-10T16:00:00.000Z'),
      },
      EXPORT_ROW_LIMIT + 1,
    );
  });

  it('mengembalikan isi dari writer dan nama file buatan server', async () => {
    const file = await useCase.execute({ user: user() });

    expect(write).toHaveBeenCalledWith(rows(2));
    expect(file).toEqual({
      fileName: 'pengaduan-keluar-IT-20261010-1205.xlsx',
      content: Buffer.from('xlsx'),
    });
  });

  it('menerima tepat sebanyak batas baris', async () => {
    findOutgoingForExport.mockResolvedValue(rows(EXPORT_ROW_LIMIT));

    await expect(useCase.execute({ user: user() })).resolves.toBeDefined();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('menolak dengan 422 alih-alih memotong diam-diam bila melebihi batas', async () => {
    findOutgoingForExport.mockResolvedValue(rows(EXPORT_ROW_LIMIT + 1));

    await expect(useCase.execute({ user: user() })).rejects.toThrow(
      new UnprocessableEntityException(EXPORT_TOO_LARGE_MESSAGE),
    );
    expect(write).not.toHaveBeenCalled();
  });

  it('menolak akun tanpa divisi sebelum menyentuh data', async () => {
    await expect(
      useCase.execute({ user: user({ role: Role.SUPERADMIN, divisi: null }) }),
    ).rejects.toThrow(new ForbiddenException(USER_WITHOUT_DIVISI_MESSAGE));
    expect(findOutgoingForExport).not.toHaveBeenCalled();
  });

  it('menolak rentang tanggal terbalik sebelum menyentuh data', async () => {
    await expect(
      useCase.execute({
        user: user(),
        dateFrom: '2026-10-10',
        dateTo: '2026-10-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findOutgoingForExport).not.toHaveBeenCalled();
  });
});

describe('exportFileName', () => {
  it('memakai kode divisi dan waktu WITA', () => {
    expect(
      exportFileName(Divisi.DIGITAL_MARKETING, new Date('2026-12-31T16:30:00Z')),
    ).toBe('pengaduan-keluar-DIGITAL_MARKETING-20270101-0030.xlsx');
  });

  it.each(Object.values(Divisi))(
    'hanya berisi karakter aman untuk header (%s)',
    (divisi) => {
      expect(exportFileName(divisi, new Date())).toMatch(
        /^pengaduan-keluar-[A-Z_]+-\d{8}-\d{4}\.xlsx$/,
      );
    },
  );
});

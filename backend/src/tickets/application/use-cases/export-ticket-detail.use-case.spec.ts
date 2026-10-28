import { NotFoundException } from '@nestjs/common';
import { AuthUser } from '../../../auth/domain/auth-user';
import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';
import { TICKET_NOT_FOUND_MESSAGE } from '../../attachments/application/use-cases/upload-attachment.use-case';
import {
  TicketDetailExport,
  TicketDetailExportWriter,
} from '../ports/ticket-detail-export-writer';
import {
  TicketDetailExportRepository,
  TicketExportSource,
} from '../ports/ticket-detail-export.repository';
import { ExportTicketDetailUseCase } from './export-ticket-detail.use-case';

const user = (role: Role, divisi: Divisi | null, id = 21): AuthUser => ({
  id,
  fullName: 'Pengguna Uji',
  role,
  divisi,
  isActive: true,
  passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
});

const staffIt = user(Role.TEAM_MAIN_OFFICE, Divisi.IT, 11);
const managerIt = user(Role.MANAGER_MAIN_OFFICE, Divisi.IT, 12);
const managerTax = user(Role.MANAGER_MAIN_OFFICE, Divisi.TAX, 22);
const staffTax = user(Role.TEAM_MAIN_OFFICE, Divisi.TAX, 23);
const managerLegal = user(Role.MANAGER_MAIN_OFFICE, Divisi.LEGAL, 31);
const superadmin = user(Role.SUPERADMIN, null, 1);

const createdAt = new Date('2026-10-08T01:00:00Z');

const source = (
  overrides: Partial<TicketExportSource> = {},
): TicketExportSource => ({
  id: 'IT-20261008-001',
  description: 'Printer lantai 2 tidak bisa mencetak',
  stage: 'DIPROSES',
  rejectedAtStage: null,
  fromDivisi: Divisi.IT,
  toDivisi: Divisi.TAX,
  createdAt,
  createdBy: { fullName: 'Ayu Lestari', divisi: Divisi.IT },
  history: [
    {
      action: 'DIBUAT',
      fromStage: null,
      createdAt,
      actor: { fullName: 'Ayu Lestari', divisi: Divisi.IT },
      reason: null,
    },
    {
      action: 'TERIMA',
      fromStage: 'MENUNGGU_MANAGER_ASAL',
      createdAt: new Date('2026-10-08T02:00:00Z'),
      actor: { fullName: 'Rina Manajer', divisi: Divisi.IT },
      reason: 'Kebutuhan sudah jelas dan mendesak',
    },
    {
      action: 'TERIMA',
      fromStage: 'MENUNGGU_MANAGER_TUJUAN',
      createdAt: new Date('2026-10-08T03:00:00Z'),
      actor: { fullName: 'Tono Pajak', divisi: Divisi.TAX },
      reason: 'Dapat dikerjakan minggu ini',
    },
  ],
  comments: [
    {
      body: 'Sudah dicek tim pajak',
      createdAt: new Date('2026-10-08T04:00:00Z'),
      author: { fullName: 'Tono Pajak', divisi: Divisi.TAX },
    },
  ],
  ...overrides,
});

describe('ExportTicketDetailUseCase', () => {
  const tickets = { findVisibility: jest.fn(), findById: jest.fn() };
  const writer = { write: jest.fn() };
  const useCase = new ExportTicketDetailUseCase(
    tickets as unknown as TicketDetailExportRepository,
    writer as unknown as TicketDetailExportWriter,
  );
  const content = Buffer.from('xlsx');

  const exportAs = async (actor: AuthUser, ticket = source()) => {
    tickets.findVisibility.mockResolvedValue(ticket);
    tickets.findById.mockResolvedValue(ticket);
    const file = await useCase.execute({ user: actor, ticketId: ticket.id });
    const [data] = writer.write.mock.calls[0] as [TicketDetailExport];
    return { file, data };
  };

  beforeEach(() => {
    jest.resetAllMocks();
    writer.write.mockResolvedValue(content);
  });

  it('menamai berkas dengan ID pengaduan', async () => {
    const { file } = await exportAs(staffIt);

    expect(file).toEqual({ fileName: 'IT-20261008-001.xlsx', content });
  });

  it('menjawab 404 kalau pengaduan tidak ada', async () => {
    tickets.findVisibility.mockResolvedValue(null);

    await expect(
      useCase.execute({ user: staffIt, ticketId: 'IT-20261008-404' }),
    ).rejects.toThrow(new NotFoundException(TICKET_NOT_FOUND_MESSAGE));
    expect(tickets.findById).not.toHaveBeenCalled();
    expect(writer.write).not.toHaveBeenCalled();
  });

  it.each([
    ['divisi lain', managerLegal, source()],
    [
      'staf divisi tujuan sebelum tiket sampai ke tujuan',
      staffTax,
      source({ stage: 'MENUNGGU_MANAGER_ASAL' }),
    ],
    [
      'divisi tujuan pada tiket yang ditolak manajer asal',
      managerTax,
      source({ stage: 'DITOLAK', rejectedAtStage: 'MENUNGGU_MANAGER_ASAL' }),
    ],
  ])('menjawab 404 untuk %s', async (_label, actor, ticket) => {
    tickets.findVisibility.mockResolvedValue(ticket);

    await expect(
      useCase.execute({ user: actor, ticketId: ticket.id }),
    ).rejects.toThrow(new NotFoundException(TICKET_NOT_FOUND_MESSAGE));
    expect(tickets.findById).not.toHaveBeenCalled();
    expect(writer.write).not.toHaveBeenCalled();
  });

  it('menjawab 404 kalau pengaduan hilang di antara dua pembacaan', async () => {
    tickets.findVisibility.mockResolvedValue(source());
    tickets.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ user: managerIt, ticketId: 'IT-20261008-001' }),
    ).rejects.toThrow(new NotFoundException(TICKET_NOT_FOUND_MESSAGE));
    expect(writer.write).not.toHaveBeenCalled();
  });

  it.each([
    ['manajer divisi asal', managerIt, true],
    ['staf divisi asal', staffIt, false],
  ])(
    'meminta alasan ke repositori hanya bila berhak: %s',
    async (_l, actor, expected) => {
      await exportAs(actor);

      expect(tickets.findById).toHaveBeenCalledWith(
        'IT-20261008-001',
        expected,
      );
    },
  );

  it('menulis nama divisi dan status sebagai label terbaca', async () => {
    const { data } = await exportAs(
      superadmin,
      source({
        fromDivisi: Divisi.YOUTUBE,
        toDivisi: Divisi.DIGITAL_MARKETING,
      }),
    );

    expect(data.information).toEqual({
      id: 'IT-20261008-001',
      fromDivisi: 'YouTube',
      toDivisi: 'Digital Marketing',
      createdBy: 'Ayu Lestari',
      createdAt,
      status: 'Diproses',
      description: 'Printer lantai 2 tidak bisa mencetak',
    });
  });

  it('memetakan riwayat ke label tahap, aktor, dan divisi terbaca', async () => {
    const { data } = await exportAs(managerIt);

    expect(
      data.history.map((row) => [row.action, row.actor, row.divisi]),
    ).toEqual([
      ['Dibuat', 'Ayu Lestari', 'IT'],
      ['Disetujui Manajer Divisi IT', 'Rina Manajer', 'IT'],
      ['Diterima Manajer Divisi Pajak', 'Tono Pajak', 'Pajak'],
    ]);
  });

  it('menulis divisi kosong untuk pelaku tanpa divisi', async () => {
    const { data } = await exportAs(
      superadmin,
      source({
        history: [
          {
            action: 'DIBUAT',
            fromStage: null,
            createdAt,
            actor: { fullName: 'Admin', divisi: null },
            reason: null,
          },
        ],
      }),
    );

    expect(data.history[0].divisi).toBeNull();
  });

  it.each([
    ['manajer divisi asal', managerIt],
    ['manajer divisi tujuan', managerTax],
    ['superadmin', superadmin],
  ])('menyertakan alasan untuk %s', async (_label, actor) => {
    const { data } = await exportAs(actor);

    expect(data.includeReason).toBe(true);
    expect(data.comments).toEqual([
      {
        author: 'Tono Pajak',
        divisi: 'Pajak',
        createdAt: new Date('2026-10-08T04:00:00Z'),
        body: 'Sudah dicek tim pajak',
      },
    ]);
    expect(data.history.map((row) => row.reason)).toEqual([
      null,
      'Kebutuhan sudah jelas dan mendesak',
      'Dapat dikerjakan minggu ini',
    ]);
  });

  it.each([
    ['staf divisi asal', staffIt],
    ['staf divisi tujuan', staffTax],
  ])('tidak menyertakan alasan untuk %s', async (_label, actor) => {
    const { data } = await exportAs(actor);

    expect(data.includeReason).toBe(false);
    expect(data.comments).toEqual([]);
    expect(data.history.every((row) => row.reason === null)).toBe(true);
    expect(JSON.stringify(data)).not.toContain('Kebutuhan sudah jelas');
    expect(JSON.stringify(data)).not.toContain('Sudah dicek tim pajak');
  });
});

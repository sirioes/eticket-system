import { Divisi } from '../../common/enums/divisi.enum';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaTicketDetailExportRepository } from './prisma-ticket-detail-export.repository';

describe('PrismaTicketDetailExportRepository', () => {
  const ticketDelegate = { findUnique: jest.fn() };
  const messageDelegate = { findMany: jest.fn() };
  const repository = new PrismaTicketDetailExportRepository({
    ticket: ticketDelegate,
    ticketMessage: messageDelegate,
  } as unknown as PrismaService);

  const createdAt = new Date('2026-10-08T01:00:00Z');
  const actor = { fullName: 'Budi', divisi: Divisi.IT };

  beforeEach(() => {
    jest.resetAllMocks();
    messageDelegate.findMany.mockResolvedValue([]);
  });

  it('mengembalikan null kalau tiket tidak ada', async () => {
    ticketDelegate.findUnique.mockResolvedValue(null);

    await expect(
      repository.findById('IT-20261008-404', true),
    ).resolves.toBeNull();
  });

  it('memuat riwayat berurutan beserta alasan dari pesan yang terhubung', async () => {
    ticketDelegate.findUnique.mockResolvedValue({
      id: 'IT-20261008-001',
      description: 'Printer rusak',
      stage: 'DIPROSES',
      rejectedAtStage: null,
      fromDivisi: Divisi.IT,
      toDivisi: Divisi.TAX,
      createdAt,
      createdBy: actor,
      stageLogs: [
        {
          action: 'DIBUAT',
          fromStage: null,
          createdAt,
          actor,
          message: null,
        },
        {
          action: 'TERIMA',
          fromStage: 'MENUNGGU_MANAGER_ASAL',
          createdAt,
          actor,
          message: { body: 'Disetujui karena mendesak' },
        },
      ],
    });

    const result = await repository.findById('IT-20261008-001', true);

    expect(result?.history).toEqual([
      { action: 'DIBUAT', fromStage: null, createdAt, actor, reason: null },
      {
        action: 'TERIMA',
        fromStage: 'MENUNGGU_MANAGER_ASAL',
        createdAt,
        actor,
        reason: 'Disetujui karena mendesak',
      },
    ]);
    expect(result).not.toHaveProperty('stageLogs');
  });

  it('memuat komentar berurutan hanya bila diminta', async () => {
    const comment = { body: 'Sudah dicek', createdAt, author: actor };
    ticketDelegate.findUnique.mockResolvedValue({
      id: 'IT-20261008-001',
      stageLogs: [],
    });
    messageDelegate.findMany.mockResolvedValue([comment]);

    const withComments = await repository.findById('IT-20261008-001', true);

    expect(withComments?.comments).toEqual([comment]);
    expect(messageDelegate.findMany).toHaveBeenCalledWith({
      where: { ticketId: 'IT-20261008-001', kind: 'KOMENTAR' },
      select: {
        body: true,
        createdAt: true,
        author: { select: { fullName: true, divisi: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    messageDelegate.findMany.mockClear();
    const without = await repository.findById('IT-20261008-001', false);

    expect(without?.comments).toEqual([]);
    expect(messageDelegate.findMany).not.toHaveBeenCalled();
  });

  it('tidak memuat isi pesan kalau alasan tidak diminta', async () => {
    ticketDelegate.findUnique.mockResolvedValue(null);

    await repository.findById('IT-20261008-001', false);

    const { select } = ticketDelegate.findUnique.mock.calls[0][0];
    expect(select.stageLogs.select).not.toHaveProperty('message');
  });

  it('findVisibility hanya memilih kolom untuk keputusan akses', async () => {
    ticketDelegate.findUnique.mockResolvedValue(null);

    await repository.findVisibility('IT-20261008-001');

    expect(ticketDelegate.findUnique).toHaveBeenCalledWith({
      where: { id: 'IT-20261008-001' },
      select: {
        fromDivisi: true,
        toDivisi: true,
        stage: true,
        rejectedAtStage: true,
      },
    });
  });

  it('meminta riwayat urut waktu lalu id dan hanya kolom yang dibutuhkan', async () => {
    ticketDelegate.findUnique.mockResolvedValue(null);

    await repository.findById('IT-20261008-001', true);

    const { where, select } = ticketDelegate.findUnique.mock.calls[0][0];
    expect(where).toEqual({ id: 'IT-20261008-001' });
    expect(select.stageLogs.orderBy).toEqual([
      { createdAt: 'asc' },
      { id: 'asc' },
    ]);
    expect(select.stageLogs.select.message).toEqual({ select: { body: true } });
    expect(select.createdBy).toEqual({
      select: { fullName: true, divisi: true },
    });
    expect(select).not.toHaveProperty('createdById');
    expect(select).not.toHaveProperty('attachments');
    expect(select).not.toHaveProperty('completionFiles');
  });
});

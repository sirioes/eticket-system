import { Divisi } from '../../common/enums/divisi.enum';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaTicketQueryRepository } from './prisma-ticket-query.repository';
import { buildIncomingWhere, buildOutgoingWhere } from './ticket-list-where';

describe('PrismaTicketQueryRepository', () => {
  const ticketDelegate = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  };
  const prisma = {
    ticket: ticketDelegate,
    $transaction: jest.fn((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  };
  const repository = new PrismaTicketQueryRepository(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    );
  });

  describe('findDetailById', () => {
    const createdAt = new Date('2026-10-08T01:00:00Z');
    const actor = { fullName: 'Budi', divisi: Divisi.IT };

    it('mengembalikan null kalau tiket tidak ada', async () => {
      ticketDelegate.findUnique.mockResolvedValue(null);

      await expect(repository.findDetailById('IT-20261008-001')).resolves.toBe(
        null,
      );
    });

    it('menamai ulang stageLogs menjadi timeline', async () => {
      const log = {
        action: 'DIBUAT',
        fromStage: null,
        toStage: 'MENUNGGU_MANAGER_ASAL',
        createdAt,
        actor,
      };
      ticketDelegate.findUnique.mockResolvedValue({
        id: 'IT-20261008-001',
        description: 'Printer rusak',
        stage: 'MENUNGGU_MANAGER_ASAL',
        fromDivisi: Divisi.IT,
        toDivisi: Divisi.FINANCE,
        rejectedAtStage: null,
        createdAt,
        createdById: 11,
        createdBy: actor,
        attachments: [],
        stageLogs: [log],
      });

      const detail = await repository.findDetailById('IT-20261008-001');

      expect(detail?.timeline).toEqual([log]);
      expect(detail).not.toHaveProperty('stageLogs');
    });

    it('tidak pernah memilih kolom sensitif pengguna seperti hash password', async () => {
      ticketDelegate.findUnique.mockResolvedValue(null);

      await repository.findDetailById('IT-20261008-001');

      const { select } = ticketDelegate.findUnique.mock.calls[0][0];
      expect(select.createdBy).toEqual({
        select: { fullName: true, divisi: true },
      });
      expect(select.stageLogs.select.actor).toEqual({
        select: { fullName: true, divisi: true },
      });
      expect(select.stageLogs.orderBy).toEqual({ createdAt: 'asc' });
      expect(select.attachments.select).not.toHaveProperty('storedName');
    });
  });

  describe('findVisibilityById', () => {
    it('hanya mengambil kolom yang dibutuhkan aturan visibilitas', async () => {
      const visibility = {
        fromDivisi: Divisi.IT,
        toDivisi: Divisi.FINANCE,
        stage: 'DIPROSES',
        rejectedAtStage: null,
      };
      ticketDelegate.findUnique.mockResolvedValue(visibility);

      await expect(repository.findVisibilityById('IT-1')).resolves.toBe(
        visibility,
      );
      expect(ticketDelegate.findUnique).toHaveBeenCalledWith({
        where: { id: 'IT-1' },
        select: {
          fromDivisi: true,
          toDivisi: true,
          stage: true,
          rejectedAtStage: true,
        },
      });
    });
  });

  describe('listOutgoing', () => {
    const scope = { fromDivisi: Divisi.IT };
    const filter = { search: 'IT-2026' };

    it('mengambil halaman terbaru lebih dulu dengan where dari builder', async () => {
      const createdAt = new Date('2026-10-08T01:00:00Z');
      ticketDelegate.findMany.mockResolvedValue([
        {
          id: 'IT-20261008-001',
          description: 'Printer rusak',
          stage: 'DIPROSES',
          fromDivisi: Divisi.IT,
          toDivisi: Divisi.FINANCE,
          createdAt,
          _count: { attachments: 2 },
        },
      ]);
      ticketDelegate.count.mockResolvedValue(21);

      const page = await repository.listOutgoing(scope, filter, {
        page: 3,
        limit: 10,
      });

      const where = buildOutgoingWhere(scope, filter);
      expect(ticketDelegate.findMany).toHaveBeenCalledWith({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 20,
        take: 10,
        select: expect.objectContaining({
          id: true,
          _count: { select: { attachments: true } },
        }),
      });
      expect(ticketDelegate.count).toHaveBeenCalledWith({ where });
      expect(page).toEqual({
        items: [
          {
            id: 'IT-20261008-001',
            description: 'Printer rusak',
            stage: 'DIPROSES',
            fromDivisi: Divisi.IT,
            toDivisi: Divisi.FINANCE,
            createdAt,
            attachmentCount: 2,
          },
        ],
        total: 21,
      });
    });

    it('memakai satu transaksi untuk daftar dan total', async () => {
      ticketDelegate.findMany.mockResolvedValue([]);
      ticketDelegate.count.mockResolvedValue(0);

      await repository.listOutgoing(scope, {}, { page: 1, limit: 10 });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('listIncoming', () => {
    it('memakai where visibilitas milik pemirsa', async () => {
      ticketDelegate.findMany.mockResolvedValue([]);
      ticketDelegate.count.mockResolvedValue(0);
      const scope = {
        viewer: { role: Role.TEAM_MAIN_OFFICE, divisi: Divisi.TAX },
      };

      await repository.listIncoming(scope, {}, { page: 1, limit: 10 });

      const where = buildIncomingWhere(scope, {});
      expect(ticketDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where, skip: 0, take: 10 }),
      );
      expect(ticketDelegate.count).toHaveBeenCalledWith({ where });
    });
  });

  describe('hitungan tahap', () => {
    it('menghitung pengaduan keluar pada tahap tertentu', async () => {
      ticketDelegate.count.mockResolvedValue(4);

      await expect(
        repository.countOutgoingInStages(Divisi.IT, ['MENUNGGU_MANAGER_ASAL']),
      ).resolves.toBe(4);
      expect(ticketDelegate.count).toHaveBeenCalledWith({
        where: {
          fromDivisi: Divisi.IT,
          stage: { in: ['MENUNGGU_MANAGER_ASAL'] },
        },
      });
    });

    it('menghitung pengaduan masuk pada tahap tertentu', async () => {
      ticketDelegate.count.mockResolvedValue(7);

      await expect(
        repository.countIncomingInStages(Divisi.TAX, [
          'MENUNGGU_STAF_TUJUAN',
          'DIPROSES',
        ]),
      ).resolves.toBe(7);
      expect(ticketDelegate.count).toHaveBeenCalledWith({
        where: {
          toDivisi: Divisi.TAX,
          stage: { in: ['MENUNGGU_STAF_TUJUAN', 'DIPROSES'] },
        },
      });
    });
  });

  describe('findOutgoingForExport', () => {
    const scope = { fromDivisi: Divisi.IT };

    it('memetakan waktu diproses dan selesai dari log tahapan', async () => {
      const processedAt = new Date('2026-10-08T02:00:00Z');
      const completedAt = new Date('2026-10-08T05:00:00Z');
      ticketDelegate.findMany.mockResolvedValue([
        {
          id: 'IT-1',
          fromDivisi: Divisi.IT,
          toDivisi: Divisi.TAX,
          stageLogs: [
            { action: 'SELESAI', createdAt: completedAt },
            { action: 'PROSES', createdAt: processedAt },
          ],
        },
        {
          id: 'IT-2',
          fromDivisi: Divisi.IT,
          toDivisi: Divisi.LEGAL,
          stageLogs: [],
        },
      ]);

      const rows = await repository.findOutgoingForExport(scope, {}, 5001);

      expect(rows).toEqual([
        {
          id: 'IT-1',
          fromDivisi: Divisi.IT,
          toDivisi: Divisi.TAX,
          processedAt,
          completedAt,
        },
        {
          id: 'IT-2',
          fromDivisi: Divisi.IT,
          toDivisi: Divisi.LEGAL,
          processedAt: null,
          completedAt: null,
        },
      ]);
    });

    it('membatasi jumlah baris dan hanya mengambil log PROSES dan SELESAI', async () => {
      ticketDelegate.findMany.mockResolvedValue([]);
      const filter = { stage: 'SELESAI' as const };

      await repository.findOutgoingForExport(scope, filter, 5001);

      expect(ticketDelegate.findMany).toHaveBeenCalledWith({
        where: buildOutgoingWhere(scope, filter),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5001,
        select: {
          id: true,
          fromDivisi: true,
          toDivisi: true,
          stageLogs: {
            where: { action: { in: ['PROSES', 'SELESAI'] } },
            select: { action: true, createdAt: true },
          },
        },
      });
    });
  });
});
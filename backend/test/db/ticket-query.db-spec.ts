import { AuthUser } from '../../src/auth/domain/auth-user';
import { Divisi } from '../../src/common/enums/divisi.enum';
import { Role } from '../../src/common/enums/role.enum';
import { TicketStage } from '../../src/generated/prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ExportOutgoingTicketsUseCase } from '../../src/tickets/application/use-cases/export-outgoing-tickets.use-case';
import { GetRecentTicketsUseCase } from '../../src/tickets/application/use-cases/get-recent-tickets.use-case';
import { GetTicketStatsUseCase } from '../../src/tickets/application/use-cases/get-ticket-stats.use-case';
import { GetActionCountsUseCase } from '../../src/tickets/application/use-cases/get-action-counts.use-case';
import { ListAllTicketsUseCase } from '../../src/tickets/application/use-cases/list-all-tickets.use-case';
import { ListIncomingTicketsUseCase } from '../../src/tickets/application/use-cases/list-incoming-tickets.use-case';
import { ListOutgoingTicketsUseCase } from '../../src/tickets/application/use-cases/list-outgoing-tickets.use-case';
import { PrismaTicketQueryRepository } from '../../src/tickets/infrastructure/prisma-ticket-query.repository';
import {
  connectTestDatabase,
  resetDatabase,
  SeededUser,
  seedTicket,
  seedUser,
} from './test-database';

const asAuthUser = (user: SeededUser): AuthUser => ({
  ...user,
  isActive: true,
  passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
});

const PAGE = { page: 1, limit: 100 };

describe('PrismaTicketQueryRepository on MySQL', () => {
  let prisma: PrismaService;
  let repository: PrismaTicketQueryRepository;
  let itStaff: SeededUser;
  let taxStaff: SeededUser;
  let taxManager: SeededUser;

  beforeAll(async () => {
    prisma = await connectTestDatabase();
    repository = new PrismaTicketQueryRepository(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    itStaff = await seedUser(
      prisma,
      'Staf IT DB01',
      Role.TEAM_MAIN_OFFICE,
      Divisi.IT,
    );
    taxStaff = await seedUser(
      prisma,
      'Staf Tax DB03',
      Role.TEAM_MAIN_OFFICE,
      Divisi.TAX,
    );
    taxManager = await seedUser(
      prisma,
      'Manager Tax DB04',
      Role.MANAGER_MAIN_OFFICE,
      Divisi.TAX,
    );
  });

  const seedFromIt = (
    id: string,
    stage: TicketStage,
    extra: { rejectedAtStage?: TicketStage; createdAt?: Date } = {},
  ) =>
    seedTicket(prisma, {
      id,
      fromDivisi: Divisi.IT,
      toDivisi: Divisi.TAX,
      createdById: itStaff.id,
      stage,
      ...extra,
    });

  const incomingIds = async (viewer: SeededUser) => {
    const view = await new ListIncomingTicketsUseCase(repository).execute({
      user: asAuthUser(viewer),
      ...PAGE,
    });
    return view.items.map((item) => item.id).sort();
  };

  describe('incoming visibility', () => {
    beforeEach(async () => {
      await seedFromIt('IT-ASAL', 'MENUNGGU_MANAGER_ASAL');
      await seedFromIt('IT-TUJUAN', 'MENUNGGU_MANAGER_TUJUAN');
      await seedFromIt('IT-STAF', 'MENUNGGU_STAF_TUJUAN');
      await seedFromIt('IT-SELESAI', 'SELESAI');
      await seedFromIt('IT-TOLAK-ASAL', 'DITOLAK', {
        rejectedAtStage: 'MENUNGGU_MANAGER_ASAL',
      });
      await seedFromIt('IT-TOLAK-TUJUAN', 'DITOLAK', {
        rejectedAtStage: 'MENUNGGU_MANAGER_TUJUAN',
      });
    });

    it('hides tickets still waiting for their own manager and those rejected there', async () => {
      await expect(incomingIds(taxManager)).resolves.toEqual([
        'IT-SELESAI',
        'IT-STAF',
        'IT-TOLAK-TUJUAN',
        'IT-TUJUAN',
      ]);
    });

    it('also hides the destination manager queue from staff', async () => {
      await expect(incomingIds(taxStaff)).resolves.toEqual([
        'IT-SELESAI',
        'IT-STAF',
        'IT-TOLAK-TUJUAN',
      ]);
    });

    it('never leaks tickets of another destination', async () => {
      const legalStaff = await seedUser(
        prisma,
        'Staf Legal DB05',
        Role.TEAM_MAIN_OFFICE,
        Divisi.LEGAL,
      );

      await expect(incomingIds(legalStaff)).resolves.toEqual([]);
    });

    it('counts only the stages the viewer can act on', async () => {
      const counts = new GetActionCountsUseCase(repository);

      await expect(counts.execute(asAuthUser(taxManager))).resolves.toEqual({
        outgoing: 0,
        incoming: 1,
      });
      await expect(counts.execute(asAuthUser(taxStaff))).resolves.toEqual({
        outgoing: 0,
        incoming: 1,
      });
    });
  });

  describe('dashboard', () => {
    const stats = (viewer: SeededUser) =>
      new GetTicketStatsUseCase(repository).execute(asAuthUser(viewer));

    const recent = async (viewer: SeededUser) =>
      (
        await new GetRecentTicketsUseCase(repository).execute(
          asAuthUser(viewer),
        )
      ).map((item) => item.id);

    const seedFromTax = (id: string, stage: TicketStage, createdAt?: Date) =>
      seedTicket(prisma, {
        id,
        fromDivisi: Divisi.TAX,
        toDivisi: Divisi.IT,
        createdById: taxStaff.id,
        stage,
        ...(createdAt && { createdAt }),
      });

    it('counts completed tickets from the incoming side only', async () => {
      await seedFromIt('IT-DONE-IN', 'SELESAI');
      await seedFromTax('TAX-DONE-OUT', 'SELESAI');
      await seedFromTax('TAX-OPEN-OUT', 'DIPROSES');

      await expect(stats(taxStaff)).resolves.toEqual({
        total: 3,
        incoming: 1,
        outgoing: 2,
        selesai: 1,
      });
      await expect(stats(itStaff)).resolves.toEqual({
        total: 3,
        incoming: 2,
        outgoing: 1,
        selesai: 1,
      });
    });

    it('applies the incoming visibility rules to the incoming count and the total', async () => {
      await seedFromIt('IT-ASAL', 'MENUNGGU_MANAGER_ASAL');
      await seedFromIt('IT-TUJUAN', 'MENUNGGU_MANAGER_TUJUAN');
      await seedFromIt('IT-STAF', 'MENUNGGU_STAF_TUJUAN');
      await seedFromIt('IT-TOLAK-ASAL', 'DITOLAK', {
        rejectedAtStage: 'MENUNGGU_MANAGER_ASAL',
      });

      await expect(stats(taxManager)).resolves.toMatchObject({
        incoming: 2,
        outgoing: 0,
        total: 2,
      });
      await expect(stats(taxStaff)).resolves.toMatchObject({
        incoming: 1,
        outgoing: 0,
        total: 1,
      });
      await expect(stats(itStaff)).resolves.toMatchObject({
        incoming: 0,
        outgoing: 4,
        total: 4,
      });
    });

    it('never counts tickets between two other divisi', async () => {
      const legalStaff = await seedUser(
        prisma,
        'Staf Legal DB05',
        Role.TEAM_MAIN_OFFICE,
        Divisi.LEGAL,
      );
      await seedFromIt('IT-TAX', 'SELESAI');

      await expect(stats(legalStaff)).resolves.toEqual({
        total: 0,
        incoming: 0,
        outgoing: 0,
        selesai: 0,
      });
      await expect(recent(legalStaff)).resolves.toEqual([]);
    });

    it('mixes incoming and outgoing tickets, newest first, at most seven', async () => {
      for (let index = 1; index <= 5; index += 1) {
        await seedFromIt(`IT-OUT-${index}`, 'SELESAI', {
          createdAt: new Date(`2026-10-0${index}T02:00:00.000Z`),
        });
      }
      for (let index = 6; index <= 9; index += 1) {
        await seedFromTax(
          `TAX-OUT-${index}`,
          'SELESAI',
          new Date(`2026-10-0${index}T02:00:00.000Z`),
        );
      }

      await expect(recent(taxStaff)).resolves.toEqual([
        'TAX-OUT-9',
        'TAX-OUT-8',
        'TAX-OUT-7',
        'TAX-OUT-6',
        'IT-OUT-5',
        'IT-OUT-4',
        'IT-OUT-3',
      ]);
    });

    it('hides incoming tickets the viewer may not see from the recent list', async () => {
      await seedFromIt('IT-ASAL', 'MENUNGGU_MANAGER_ASAL');
      await seedFromIt('IT-TUJUAN', 'MENUNGGU_MANAGER_TUJUAN');
      await seedFromIt('IT-STAF', 'MENUNGGU_STAF_TUJUAN');

      await expect(recent(taxManager)).resolves.toEqual(
        expect.arrayContaining(['IT-TUJUAN', 'IT-STAF']),
      );
      await expect(recent(taxManager)).resolves.not.toContain('IT-ASAL');
      await expect(recent(taxStaff)).resolves.toEqual(['IT-STAF']);
    });
  });

  describe('filters', () => {
    const outgoing = (filter: Record<string, string> = {}) =>
      new ListOutgoingTicketsUseCase(repository)
        .execute({ user: asAuthUser(itStaff), ...PAGE, ...filter })
        .then((view) => view.items.map((item) => item.id).sort());

    it('treats the WITA calendar day as the boundary', async () => {
      await seedFromIt('IT-LAST-SECOND', 'SELESAI', {
        createdAt: new Date('2026-10-09T15:59:59.999Z'),
      });
      await seedFromIt('IT-MIDNIGHT', 'SELESAI', {
        createdAt: new Date('2026-10-09T16:00:00.000Z'),
      });

      await expect(
        outgoing({ dateFrom: '2026-10-09', dateTo: '2026-10-09' }),
      ).resolves.toEqual(['IT-LAST-SECOND']);
      await expect(
        outgoing({ dateFrom: '2026-10-10', dateTo: '2026-10-10' }),
      ).resolves.toEqual(['IT-MIDNIGHT']);
    });

    it('stores and reads timestamps without a timezone shift', async () => {
      const createdAt = new Date('2026-10-09T15:59:59.123Z');
      await seedFromIt('IT-ROUND-TRIP', 'SELESAI', { createdAt });

      const stored = await prisma.ticket.findUniqueOrThrow({
        where: { id: 'IT-ROUND-TRIP' },
        select: { createdAt: true },
      });

      expect(stored.createdAt.toISOString()).toBe(createdAt.toISOString());
    });

    it('searches by ID only, ignoring letter case', async () => {
      await seedFromIt('IT-20261011-0001', 'SELESAI');
      await seedFromIt('IT-20261011-0002', 'SELESAI');

      await expect(outgoing({ search: '0001' })).resolves.toEqual([
        'IT-20261011-0001',
      ]);
      await expect(outgoing({ search: 'it-20261011-0002' })).resolves.toEqual([
        'IT-20261011-0002',
      ]);
      await expect(outgoing({ search: 'Deskripsi' })).resolves.toEqual([]);
    });

    it.each(['%', '_', 'IT_20261011', '\\'])(
      'treats %p literally even when the repository is called directly',
      async (search) => {
        await seedFromIt('IT-20261011-0001', 'SELESAI');

        const page = await repository.listOutgoing(
          { fromDivisi: Divisi.IT },
          { search },
          PAGE,
        );

        expect(page.total).toBe(0);
      },
    );

    it('combines filters with the scope instead of widening it', async () => {
      await seedFromIt('IT-TAX', 'SELESAI');
      await seedTicket(prisma, {
        id: 'TAX-IT',
        fromDivisi: Divisi.TAX,
        toDivisi: Divisi.IT,
        createdById: taxStaff.id,
        stage: 'SELESAI',
      });

      await expect(outgoing({ divisi: Divisi.TAX })).resolves.toEqual([
        'IT-TAX',
      ]);
      await expect(outgoing({ divisi: Divisi.IT })).resolves.toEqual([]);
    });
  });

  describe('export', () => {
    it('takes the processed and completed time from the stage log', async () => {
      await seedFromIt('IT-EXPORT', 'SELESAI');
      const processedAt = new Date('2026-10-10T01:00:00.000Z');
      const completedAt = new Date('2026-10-10T03:30:00.000Z');
      await prisma.ticketStageLog.createMany({
        data: [
          {
            ticketId: 'IT-EXPORT',
            action: 'PROSES',
            fromStage: 'MENUNGGU_STAF_TUJUAN',
            toStage: 'DIPROSES',
            actorId: taxStaff.id,
            createdAt: processedAt,
          },
          {
            ticketId: 'IT-EXPORT',
            action: 'SELESAI',
            fromStage: 'DIPROSES',
            toStage: 'SELESAI',
            actorId: taxStaff.id,
            createdAt: completedAt,
          },
        ],
      });

      const rows = await repository.findOutgoingForExport(
        { fromDivisi: Divisi.IT },
        {},
        10,
      );

      expect(rows).toEqual([
        {
          id: 'IT-EXPORT',
          fromDivisi: 'IT',
          toDivisi: 'TAX',
          processedAt,
          completedAt,
        },
      ]);
    });

    it('produces a workbook through the real query', async () => {
      await seedFromIt('IT-FILE', 'MENUNGGU_MANAGER_ASAL');
      const file = await new ExportOutgoingTicketsUseCase(repository, {
        write: async (rows) => Buffer.from(JSON.stringify(rows)),
      }).execute({ user: asAuthUser(itStaff) });

      expect(JSON.parse(file.content.toString())).toEqual([
        {
          id: 'IT-FILE',
          fromDivisi: 'IT',
          toDivisi: 'TAX',
          processedAt: null,
          completedAt: null,
        },
      ]);
    });
  });

  describe('all tickets', () => {
    const allIds = async (
      filter: { divisi?: Divisi; status?: TicketStage; search?: string } = {},
    ) => {
      const view = await new ListAllTicketsUseCase(repository).execute({
        ...PAGE,
        ...filter,
      });
      return view.items.map((item) => item.id).sort();
    };

    beforeEach(async () => {
      await seedFromIt('IT-ASAL', 'MENUNGGU_MANAGER_ASAL');
      await seedFromIt('IT-TOLAK-ASAL', 'DITOLAK', {
        rejectedAtStage: 'MENUNGGU_MANAGER_ASAL',
      });
      await seedFromIt('IT-SELESAI', 'SELESAI');
      await seedTicket(prisma, {
        id: 'TAX-LEGAL',
        fromDivisi: Divisi.TAX,
        toDivisi: Divisi.LEGAL,
        createdById: taxStaff.id,
      });
    });

    it('lists every ticket of every divisi in every stage, including those hidden from the destination', async () => {
      await expect(allIds()).resolves.toEqual([
        'IT-ASAL',
        'IT-SELESAI',
        'IT-TOLAK-ASAL',
        'TAX-LEGAL',
      ]);
    });

    it('matches the divisi filter on either the origin or the destination', async () => {
      await expect(allIds({ divisi: Divisi.TAX })).resolves.toEqual([
        'IT-ASAL',
        'IT-SELESAI',
        'IT-TOLAK-ASAL',
        'TAX-LEGAL',
      ]);
      await expect(allIds({ divisi: Divisi.IT })).resolves.toEqual([
        'IT-ASAL',
        'IT-SELESAI',
        'IT-TOLAK-ASAL',
      ]);
      await expect(allIds({ divisi: Divisi.LEGAL })).resolves.toEqual([
        'TAX-LEGAL',
      ]);
      await expect(allIds({ divisi: Divisi.FINANCE })).resolves.toEqual([]);
    });

    it('combines the status filter and the ID search', async () => {
      await expect(allIds({ status: 'DITOLAK' })).resolves.toEqual([
        'IT-TOLAK-ASAL',
      ]);
      await expect(allIds({ search: 'IT-' })).resolves.toEqual([
        'IT-ASAL',
        'IT-SELESAI',
        'IT-TOLAK-ASAL',
      ]);
      await expect(
        allIds({ search: 'IT-', status: 'SELESAI' }),
      ).resolves.toEqual(['IT-SELESAI']);
    });

    it('reports the total across pages', async () => {
      const view = await new ListAllTicketsUseCase(repository).execute({
        page: 2,
        limit: 3,
      });

      expect(view).toMatchObject({ total: 4, totalPages: 2, page: 2 });
      expect(view.items).toHaveLength(1);
    });
  });
});

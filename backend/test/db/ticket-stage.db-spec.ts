import { Divisi } from '../../src/common/enums/divisi.enum';
import { Role } from '../../src/common/enums/role.enum';
import { Prisma } from '../../src/generated/prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PrismaTicketStageRepository } from '../../src/tickets/infrastructure/prisma-ticket-stage.repository';
import {
  connectTestDatabase,
  resetDatabase,
  SeededUser,
  seedTicket,
  seedUser,
} from './test-database';

const TICKET_ID = 'IT-20261011-0001';

describe('PrismaTicketStageRepository on MySQL', () => {
  let prisma: PrismaService;
  let repository: PrismaTicketStageRepository;
  let staff: SeededUser;
  let manager: SeededUser;

  beforeAll(async () => {
    prisma = await connectTestDatabase();
    repository = new PrismaTicketStageRepository(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    staff = await seedUser(prisma, 'Staf IT DB01', Role.TEAM_MAIN_OFFICE, Divisi.IT);
    manager = await seedUser(
      prisma,
      'Manager IT DB02',
      Role.MANAGER_MAIN_OFFICE,
      Divisi.IT,
    );
    await seedTicket(prisma, {
      id: TICKET_ID,
      fromDivisi: Divisi.IT,
      toDivisi: Divisi.TAX,
      createdById: staff.id,
    });
  });

  const accept = () =>
    repository.advanceStage({
      ticketId: TICKET_ID,
      expectedStage: 'MENUNGGU_MANAGER_ASAL',
      action: 'TERIMA',
      nextStage: 'MENUNGGU_MANAGER_TUJUAN',
      actorId: manager.id,
    });

  const reject = () =>
    repository.advanceStage({
      ticketId: TICKET_ID,
      expectedStage: 'MENUNGGU_MANAGER_ASAL',
      action: 'TOLAK',
      nextStage: 'DITOLAK',
      actorId: manager.id,
    });

  const ticket = () =>
    prisma.ticket.findUniqueOrThrow({
      where: { id: TICKET_ID },
      select: { stage: true, rejectedAtStage: true, rejectedById: true },
    });

  const logsFrom = (fromStage: 'MENUNGGU_MANAGER_ASAL') =>
    prisma.ticketStageLog.findMany({
      where: { ticketId: TICKET_ID, fromStage },
      select: { action: true, toStage: true, actorId: true },
    });

  it('moves the stage and writes exactly one log row', async () => {
    await expect(accept()).resolves.toBe(true);

    await expect(ticket()).resolves.toEqual({
      stage: 'MENUNGGU_MANAGER_TUJUAN',
      rejectedAtStage: null,
      rejectedById: null,
    });
    await expect(logsFrom('MENUNGGU_MANAGER_ASAL')).resolves.toEqual([
      {
        action: 'TERIMA',
        toStage: 'MENUNGGU_MANAGER_TUJUAN',
        actorId: manager.id,
      },
    ]);
  });

  it('records who rejected and at which stage', async () => {
    await expect(reject()).resolves.toBe(true);

    await expect(ticket()).resolves.toEqual({
      stage: 'DITOLAK',
      rejectedAtStage: 'MENUNGGU_MANAGER_ASAL',
      rejectedById: manager.id,
    });
  });

  it('refuses a stale expected stage without writing a log', async () => {
    await accept();

    await expect(accept()).resolves.toBe(false);
    await expect(logsFrom('MENUNGGU_MANAGER_ASAL')).resolves.toHaveLength(1);
  });

  it('refuses a stale stage on a ticket that has no log row for it', async () => {
    await prisma.ticket.update({
      where: { id: TICKET_ID },
      data: { stage: 'MENUNGGU_MANAGER_TUJUAN' },
    });

    await expect(accept()).resolves.toBe(false);
    await expect(ticket()).resolves.toMatchObject({
      stage: 'MENUNGGU_MANAGER_TUJUAN',
    });
    await expect(logsFrom('MENUNGGU_MANAGER_ASAL')).resolves.toHaveLength(0);
  });

  it('lets exactly one of many simultaneous actions win', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        index % 2 === 0 ? accept() : reject(),
      ),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
    const logs = await logsFrom('MENUNGGU_MANAGER_ASAL');
    expect(logs).toHaveLength(1);
    const current = await ticket();
    expect(current.stage).toBe(logs[0].toStage);
    expect(current.rejectedAtStage).toBe(
      logs[0].action === 'TOLAK' ? 'MENUNGGU_MANAGER_ASAL' : null,
    );
  });

  it('rolls the stage back when the log row collides with the unique key', async () => {
    await prisma.ticketStageLog.create({
      data: {
        ticketId: TICKET_ID,
        action: 'TERIMA',
        fromStage: 'MENUNGGU_MANAGER_ASAL',
        toStage: 'MENUNGGU_MANAGER_TUJUAN',
        actorId: manager.id,
      },
    });

    await expect(accept()).resolves.toBe(false);
    await expect(ticket()).resolves.toMatchObject({
      stage: 'MENUNGGU_MANAGER_ASAL',
    });
  });

  it('is backed by a real unique key on (ticketId, fromStage)', async () => {
    const duplicate = () =>
      prisma.ticketStageLog.create({
        data: {
          ticketId: TICKET_ID,
          action: 'TOLAK',
          fromStage: 'MENUNGGU_MANAGER_ASAL',
          toStage: 'DITOLAK',
          actorId: manager.id,
        },
      });
    await duplicate();

    const error: unknown = await duplicate().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((error as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
  });
});

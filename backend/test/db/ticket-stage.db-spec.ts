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

const REASON = 'Sudah sesuai dengan kebutuhan divisi';

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

  const accept = (reason: string | null = REASON) =>
    repository.advanceStage({
      ticketId: TICKET_ID,
      expectedStage: 'MENUNGGU_MANAGER_ASAL',
      action: 'TERIMA',
      nextStage: 'MENUNGGU_MANAGER_TUJUAN',
      actorId: manager.id,
      reason,
    });

  const reject = (reason: string | null = REASON) =>
    repository.advanceStage({
      ticketId: TICKET_ID,
      expectedStage: 'MENUNGGU_MANAGER_ASAL',
      action: 'TOLAK',
      nextStage: 'DITOLAK',
      actorId: manager.id,
      reason,
    });

  const messages = () =>
    prisma.ticketMessage.findMany({
      where: { ticketId: TICKET_ID },
      select: {
        kind: true,
        body: true,
        authorId: true,
        stageLog: { select: { action: true, fromStage: true } },
      },
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

  it('stores the reason as an ALASAN message tied to the log row of the same step', async () => {
    await expect(accept()).resolves.toBe(true);

    await expect(messages()).resolves.toEqual([
      {
        kind: 'ALASAN',
        body: REASON,
        authorId: manager.id,
        stageLog: { action: 'TERIMA', fromStage: 'MENUNGGU_MANAGER_ASAL' },
      },
    ]);
  });

  it('stores the reason of a rejection too', async () => {
    await expect(reject()).resolves.toBe(true);

    await expect(messages()).resolves.toMatchObject([
      { kind: 'ALASAN', stageLog: { action: 'TOLAK' } },
    ]);
  });

  it('writes no message when there is no reason', async () => {
    await expect(accept(null)).resolves.toBe(true);

    await expect(messages()).resolves.toEqual([]);
  });

  it('writes no message when the stage was already taken', async () => {
    await accept();

    await expect(accept('Alasan kedua yang terlambat')).resolves.toBe(false);
    await expect(messages()).resolves.toHaveLength(1);
  });

  it('keeps exactly one message when many actions race', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        index % 2 === 0
          ? accept(`Alasan terima nomor ${index}`)
          : reject(`Alasan tolak nomor ${index}`),
      ),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
    const stored = await messages();
    expect(stored).toHaveLength(1);
    const [log] = await logsFrom('MENUNGGU_MANAGER_ASAL');
    expect(stored[0].stageLog?.action).toBe(log.action);
  });

  it('rolls the stage and the log back when the reason cannot be stored', async () => {
    await expect(accept('a'.repeat(70_000))).rejects.toBeDefined();

    await expect(ticket()).resolves.toMatchObject({
      stage: 'MENUNGGU_MANAGER_ASAL',
    });
    await expect(logsFrom('MENUNGGU_MANAGER_ASAL')).resolves.toHaveLength(0);
    await expect(messages()).resolves.toHaveLength(0);
  });

  it('is backed by a real unique key on the log row of a message', async () => {
    await accept();
    const log = await prisma.ticketStageLog.findFirstOrThrow({
      where: { ticketId: TICKET_ID, fromStage: 'MENUNGGU_MANAGER_ASAL' },
      select: { id: true },
    });

    const error: unknown = await prisma.ticketMessage
      .create({
        data: {
          ticketId: TICKET_ID,
          authorId: manager.id,
          kind: 'ALASAN',
          body: 'Alasan ganda untuk log yang sama',
          stageLogId: log.id,
        },
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((error as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
  });
});

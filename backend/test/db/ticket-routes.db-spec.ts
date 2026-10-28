import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { Divisi } from '../../src/common/enums/divisi.enum';
import { Role } from '../../src/common/enums/role.enum';
import { CROSS_SITE_MESSAGE } from '../../src/common/guards/fetch-metadata.guard';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  assertTestDatabase,
  resetDatabase,
  resetTickets,
  seedTicket,
  seedUser,
  TEST_PASSWORD,
} from './test-database';

process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.COOKIE_SECURE = 'false';
process.env.CORS_ORIGIN = 'https://eticket.example';

const ITEM = 'IT-20261011-0001';

const REASON = 'Sudah sesuai dengan kebutuhan divisi';

describe('Ticket routes on MySQL', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cookies = new Map<string, string>();
  const ids = new Map<string, number>();

  const ACCOUNTS = [
    ['Staf IT DB01', Role.TEAM_MAIN_OFFICE, Divisi.IT],
    ['Manager IT DB02', Role.MANAGER_MAIN_OFFICE, Divisi.IT],
    ['Staf Tax DB03', Role.TEAM_MAIN_OFFICE, Divisi.TAX],
    ['Manager Tax DB04', Role.MANAGER_MAIN_OFFICE, Divisi.TAX],
    ['Super Admin DB05', Role.SUPERADMIN, null],
  ] as const;

  const server = () => app.getHttpServer();

  const login = async (fullName: string) => {
    const response = await request(server())
      .post('/auth/login')
      .send({ fullName, password: TEST_PASSWORD })
      .expect(200);
    const header = response.headers['set-cookie'];
    return (Array.isArray(header) ? header : [header])[0].split(';')[0];
  };

  const idOf = (fullName: string) => {
    const id = ids.get(fullName);
    if (id === undefined) throw new Error(`akun tidak dikenal: ${fullName}`);
    return id;
  };

  const as = (fullName: string) => {
    const cookie = cookies.get(fullName);
    if (!cookie) throw new Error(`belum login: ${fullName}`);
    return cookie;
  };

  const patchStage = (
    fullName: string,
    action: string,
    id = ITEM,
    reason?: string,
  ) =>
    request(server())
      .patch(`/tickets/${id}/stage`)
      .set('Cookie', as(fullName))
      .send(reason === undefined ? { action } : { action, reason });

  const stageInDb = async (id = ITEM) =>
    (
      await prisma.ticket.findUniqueOrThrow({
        where: { id },
        select: { stage: true },
      })
    ).stage;

  beforeAll(async () => {
    assertTestDatabase();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await resetDatabase(prisma);
    for (const [fullName, role, divisi] of ACCOUNTS) {
      const user = await seedUser(prisma, fullName, role, divisi);
      ids.set(fullName, user.id);
    }
    for (const [fullName] of ACCOUNTS) {
      cookies.set(fullName, await login(fullName));
    }
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  beforeEach(async () => {
    await resetTickets(prisma);
  });

  const seedItTicket = () =>
    seedTicket(prisma, {
      id: ITEM,
      fromDivisi: Divisi.IT,
      toDivisi: Divisi.TAX,
      createdById: idOf('Staf IT DB01'),
    });

  it('walks a ticket from creation to processing with the right actor and a reason at every decision', async () => {
    const created = await request(server())
      .post('/tickets')
      .set('Cookie', as('Staf IT DB01'))
      .send({
        toDivisi: Divisi.TAX,
        description: 'Laptop divisi IT perlu cek pajak pembelian',
      })
      .expect(201);
    const id: string = created.body.id;

    const steps = [
      ['Manager IT DB02', 'TERIMA', 'MENUNGGU_MANAGER_TUJUAN', REASON],
      ['Manager Tax DB04', 'TERIMA', 'MENUNGGU_STAF_TUJUAN', REASON],
      ['Staf Tax DB03', 'PROSES', 'DIPROSES', undefined],
    ] as const;
    for (const [actor, action, expected, reason] of steps) {
      const response = await patchStage(actor, action, id, reason);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id, stage: expected });
    }

    await expect(
      prisma.ticketMessage.findMany({
        where: { ticketId: id },
        orderBy: { createdAt: 'asc' },
        select: { kind: true, body: true, author: { select: { fullName: true } } },
      }),
    ).resolves.toEqual([
      { kind: 'ALASAN', body: REASON, author: { fullName: 'Manager IT DB02' } },
      { kind: 'ALASAN', body: REASON, author: { fullName: 'Manager Tax DB04' } },
    ]);

    const detail = await request(server())
      .get(`/tickets/${id}`)
      .set('Cookie', as('Staf IT DB01'))
      .expect(200);
    expect(detail.body.stage).toBe('DIPROSES');
    expect(detail.body.availableActions).toEqual([]);
    expect(
      detail.body.timeline.map(
        (entry: { action: string; actor: { fullName: string } }) =>
          `${entry.action}:${entry.actor.fullName}`,
      ),
    ).toEqual([
      'DIBUAT:Staf IT DB01',
      'TERIMA:Manager IT DB02',
      'TERIMA:Manager Tax DB04',
      'PROSES:Staf Tax DB03',
    ]);
  });

  it('refuses to complete a ticket through the stage endpoint', async () => {
    await seedTicket(prisma, {
      id: ITEM,
      fromDivisi: Divisi.IT,
      toDivisi: Divisi.TAX,
      createdById: idOf('Staf IT DB01'),
      stage: 'DIPROSES',
    });

    const response = await patchStage('Staf Tax DB03', 'SELESAI');

    expect(response.status).toBe(400);
    await expect(stageInDb()).resolves.toBe('DIPROSES');
  });

  it.each([
    ['without a reason', undefined],
    ['with a short reason', 'singkat'],
  ])('refuses a decision %s and leaves no trace', async (_label, reason) => {
    await seedItTicket();

    const response = await patchStage('Manager IT DB02', 'TERIMA', ITEM, reason);

    expect(response.status).toBe(400);
    await expect(stageInDb()).resolves.toBe('MENUNGGU_MANAGER_ASAL');
    await expect(
      prisma.ticketMessage.count({ where: { ticketId: ITEM } }),
    ).resolves.toBe(0);
    await expect(
      prisma.ticketStageLog.count({ where: { ticketId: ITEM } }),
    ).resolves.toBe(1);
  });

  it('turns a double click into one success and one conflict', async () => {
    await seedItTicket();

    const statuses = (
      await Promise.all([
        patchStage('Manager IT DB02', 'TERIMA', ITEM, REASON),
        patchStage('Manager IT DB02', 'TERIMA', ITEM, REASON),
      ])
    )
      .map((response) => response.status)
      .sort((a, b) => a - b);

    expect(statuses).toEqual([200, 409]);
    await expect(
      prisma.ticketStageLog.count({
        where: { ticketId: ITEM, action: 'TERIMA' },
      }),
    ).resolves.toBe(1);
    await expect(stageInDb()).resolves.toBe('MENUNGGU_MANAGER_TUJUAN');
    await expect(
      prisma.ticketMessage.count({ where: { ticketId: ITEM } }),
    ).resolves.toBe(1);
  });

  it('lets only one of an accept and a reject sent together win', async () => {
    await seedItTicket();

    const responses = await Promise.all([
      patchStage('Manager IT DB02', 'TERIMA', ITEM, REASON),
      patchStage('Manager IT DB02', 'TOLAK', ITEM, REASON),
    ]);

    expect(
      responses.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([200, 409]);
    const winner = responses.find((response) => response.status === 200);
    await expect(stageInDb()).resolves.toBe(winner?.body.stage);
    await expect(
      prisma.ticketMessage.count({ where: { ticketId: ITEM } }),
    ).resolves.toBe(1);
  });

  it('refuses a cross-site stage change and leaves the database untouched', async () => {
    await seedItTicket();

    const response = await request(server())
      .patch(`/tickets/${ITEM}/stage`)
      .set('Cookie', as('Manager IT DB02'))
      .set('Sec-Fetch-Site', 'cross-site')
      .send({ action: 'TERIMA', reason: REASON });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(CROSS_SITE_MESSAGE);
    await expect(stageInDb()).resolves.toBe('MENUNGGU_MANAGER_ASAL');
    await expect(
      prisma.ticketStageLog.count({ where: { ticketId: ITEM } }),
    ).resolves.toBe(1);
  });

  it('answers 404 to a manager of another divisi and changes nothing', async () => {
    await seedItTicket();

    const response = await patchStage('Manager Tax DB04', 'TERIMA', ITEM, REASON);

    expect(response.status).toBe(404);
    await expect(stageInDb()).resolves.toBe('MENUNGGU_MANAGER_ASAL');
  });

  it('answers 403 to a staff member of the right divisi at a manager stage', async () => {
    await seedItTicket();

    const response = await patchStage('Staf IT DB01', 'TERIMA', ITEM, REASON);

    expect(response.status).toBe(403);
    await expect(stageInDb()).resolves.toBe('MENUNGGU_MANAGER_ASAL');
  });

  describe('superadmin all-tickets view', () => {
    it('lists a ticket of an unrelated divisi and opens its detail without any action', async () => {
      await seedItTicket();

      const list = await request(server())
        .get('/tickets/all')
        .set('Cookie', as('Super Admin DB05'))
        .expect(200);
      expect(list.body.items.map((item: { id: string }) => item.id)).toEqual([
        ITEM,
      ]);
      expect(list.body.total).toBe(1);

      const detail = await request(server())
        .get(`/tickets/${ITEM}`)
        .set('Cookie', as('Super Admin DB05'))
        .expect(200);
      expect(detail.body.availableActions).toEqual([]);
      expect(detail.body.canUploadAttachment).toBe(false);
    });

    it('cannot change the stage of a ticket', async () => {
      await seedItTicket();

      await patchStage('Super Admin DB05', 'TERIMA', ITEM, REASON).expect(403);

      await expect(stageInDb()).resolves.toBe('MENUNGGU_MANAGER_ASAL');
    });

    it.each([
      'Staf IT DB01',
      'Manager IT DB02',
      'Staf Tax DB03',
      'Manager Tax DB04',
    ])('refuses %s', async (fullName) => {
      await request(server())
        .get('/tickets/all')
        .set('Cookie', as(fullName))
        .expect(403);
    });
  });
});

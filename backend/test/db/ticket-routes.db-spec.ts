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

  const patchStage = (fullName: string, action: string, id = ITEM) =>
    request(server())
      .patch(`/tickets/${id}/stage`)
      .set('Cookie', as(fullName))
      .send({ action });

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

  it('walks a ticket from creation to completion with the right actor at every stage', async () => {
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
      ['Manager IT DB02', 'TERIMA', 'MENUNGGU_MANAGER_TUJUAN'],
      ['Manager Tax DB04', 'TERIMA', 'MENUNGGU_STAF_TUJUAN'],
      ['Staf Tax DB03', 'PROSES', 'DIPROSES'],
      ['Staf Tax DB03', 'SELESAI', 'SELESAI'],
    ] as const;
    for (const [actor, action, expected] of steps) {
      const response = await patchStage(actor, action, id);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id, stage: expected });
    }

    const detail = await request(server())
      .get(`/tickets/${id}`)
      .set('Cookie', as('Staf IT DB01'))
      .expect(200);
    expect(detail.body.stage).toBe('SELESAI');
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
      'SELESAI:Staf Tax DB03',
    ]);
  });

  it('turns a double click into one success and one conflict', async () => {
    await seedItTicket();

    const statuses = (
      await Promise.all([
        patchStage('Manager IT DB02', 'TERIMA'),
        patchStage('Manager IT DB02', 'TERIMA'),
      ])
    )
      .map((response) => response.status)
      .sort((a, b) => a - b);

    expect(statuses).toEqual([200, 409]);
    await expect(
      prisma.ticketStageLog.count({ where: { ticketId: ITEM, action: 'TERIMA' } }),
    ).resolves.toBe(1);
    await expect(stageInDb()).resolves.toBe('MENUNGGU_MANAGER_TUJUAN');
  });

  it('lets only one of an accept and a reject sent together win', async () => {
    await seedItTicket();

    const responses = await Promise.all([
      patchStage('Manager IT DB02', 'TERIMA'),
      patchStage('Manager IT DB02', 'TOLAK'),
    ]);

    expect(
      responses.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([
      200, 409,
    ]);
    const winner = responses.find((response) => response.status === 200);
    await expect(stageInDb()).resolves.toBe(winner?.body.stage);
  });

  it('refuses a cross-site stage change and leaves the database untouched', async () => {
    await seedItTicket();

    const response = await request(server())
      .patch(`/tickets/${ITEM}/stage`)
      .set('Cookie', as('Manager IT DB02'))
      .set('Sec-Fetch-Site', 'cross-site')
      .send({ action: 'TERIMA' });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(CROSS_SITE_MESSAGE);
    await expect(stageInDb()).resolves.toBe('MENUNGGU_MANAGER_ASAL');
    await expect(
      prisma.ticketStageLog.count({ where: { ticketId: ITEM } }),
    ).resolves.toBe(1);
  });

  it('answers 404 to a manager of another divisi and changes nothing', async () => {
    await seedItTicket();

    const response = await patchStage('Manager Tax DB04', 'TERIMA');

    expect(response.status).toBe(404);
    await expect(stageInDb()).resolves.toBe('MENUNGGU_MANAGER_ASAL');
  });

  it('answers 403 to a staff member of the right divisi at a manager stage', async () => {
    await seedItTicket();

    const response = await patchStage('Staf IT DB01', 'TERIMA');

    expect(response.status).toBe(403);
    await expect(stageInDb()).resolves.toBe('MENUNGGU_MANAGER_ASAL');
  });
});

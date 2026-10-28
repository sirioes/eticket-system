import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { ACCESS_TOKEN_COOKIE } from '../../src/auth/auth.constants';
import { Divisi } from '../../src/common/enums/divisi.enum';
import { Role } from '../../src/common/enums/role.enum';
import { CROSS_SITE_MESSAGE } from '../../src/common/guards/fetch-metadata.guard';
import { TicketStage } from '../../src/generated/prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  assertTestDatabase,
  resetDatabase,
  resetTickets,
  seedTicket,
  seedUser,
} from './test-database';

process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.COOKIE_SECURE = 'false';
process.env.CORS_ORIGIN = 'https://eticket.example';

const ITEM = 'IT-20261011-0001';

const REASON = 'Sudah sesuai dengan kebutuhan divisi';

const MANAGER_IT = 'Manager IT DB02';
const MANAGER_IT_VALIDATION = 'Manager IT DB06';
const MANAGER_TAX = 'Manager Tax DB04';
const MANAGER_TAX_LIMIT = 'Manager Tax DB07';
const MANAGER_LEGAL = 'Manager Legal DB08';
const STAFF_IT = 'Staf IT DB01';
const STAFF_TAX = 'Staf Tax DB03';
const SUPERADMIN = 'Super Admin DB05';

describe('Ticket messages on MySQL', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cookies = new Map<string, string>();
  const ids = new Map<string, number>();

  const ACCOUNTS = [
    [STAFF_IT, Role.TEAM_MAIN_OFFICE, Divisi.IT],
    [MANAGER_IT, Role.MANAGER_MAIN_OFFICE, Divisi.IT],
    [STAFF_TAX, Role.TEAM_MAIN_OFFICE, Divisi.TAX],
    [MANAGER_TAX, Role.MANAGER_MAIN_OFFICE, Divisi.TAX],
    [SUPERADMIN, Role.SUPERADMIN, null],
    [MANAGER_IT_VALIDATION, Role.MANAGER_MAIN_OFFICE, Divisi.IT],
    [MANAGER_TAX_LIMIT, Role.MANAGER_MAIN_OFFICE, Divisi.TAX],
    [MANAGER_LEGAL, Role.MANAGER_MAIN_OFFICE, Divisi.LEGAL],
  ] as const;

  const server = () => app.getHttpServer();

  const sessionCookie = async (userId: number) => {
    const token = await app
      .get(JwtService, { strict: false })
      .signAsync({ sub: userId });
    return `${ACCESS_TOKEN_COOKIE}=${token}`;
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

  const getMessages = (fullName: string) =>
    request(server())
      .get(`/tickets/${ITEM}/messages`)
      .set('Cookie', as(fullName));

  const postMessage = (fullName: string, body: unknown) =>
    request(server())
      .post(`/tickets/${ITEM}/messages`)
      .set('Cookie', as(fullName))
      .send(typeof body === 'string' ? { body } : (body as object));

  const patchStage = (fullName: string, action: string, reason?: string) =>
    request(server())
      .patch(`/tickets/${ITEM}/stage`)
      .set('Cookie', as(fullName))
      .send(reason === undefined ? { action } : { action, reason });

  const messageCount = () =>
    prisma.ticketMessage.count({ where: { ticketId: ITEM } });

  const seedAt = (stage: TicketStage, rejectedAtStage?: TicketStage) =>
    seedTicket(prisma, {
      id: ITEM,
      fromDivisi: Divisi.IT,
      toDivisi: Divisi.TAX,
      createdById: idOf(STAFF_IT),
      stage,
      rejectedAtStage: rejectedAtStage ?? null,
    });

  const seedBulk = (count: number) =>
    prisma.ticketMessage.createMany({
      data: Array.from({ length: count }, (_, index) => ({
        ticketId: ITEM,
        authorId: idOf(MANAGER_IT),
        kind: 'KOMENTAR' as const,
        body: `Komentar awal ${index}`,
        createdAt: new Date(Date.UTC(2026, 9, 11, 1, 0, index)),
      })),
    });

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
      cookies.set(fullName, await sessionCookie(idOf(fullName)));
    }
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  beforeEach(async () => {
    await resetTickets(prisma);
  });

  describe('managers of both divisions', () => {
    it('exchange comments in order with the author and divisi', async () => {
      await seedAt('DIPROSES');

      const first = await postMessage(MANAGER_IT, 'Mohon dilengkapi dokumennya');
      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({
        kind: 'KOMENTAR',
        reasonLabel: null,
        body: 'Mohon dilengkapi dokumennya',
        author: { fullName: MANAGER_IT, divisi: Divisi.IT },
      });
      await postMessage(MANAGER_TAX, 'Baik, segera kami lengkapi').expect(201);

      for (const reader of [MANAGER_IT, MANAGER_TAX, SUPERADMIN]) {
        const list = await getMessages(reader).expect(200);
        expect(
          list.body.map((m: { body: string; author: { divisi: string } }) => [
            m.body,
            m.author.divisi,
          ]),
        ).toEqual([
          ['Mohon dilengkapi dokumennya', Divisi.IT],
          ['Baik, segera kami lengkapi', Divisi.TAX],
        ]);
      }
    });

    it('can write while the ticket waits for the destination manager', async () => {
      await seedAt('MENUNGGU_MANAGER_TUJUAN');

      await postMessage(MANAGER_TAX, 'Kami pelajari dulu').expect(201);
      await postMessage(MANAGER_IT_VALIDATION, 'Silakan').expect(201);
    });

    it('see the decision reasons labelled by the step that produced them', async () => {
      await seedAt('MENUNGGU_MANAGER_ASAL');
      await patchStage(MANAGER_IT, 'TERIMA', REASON).expect(200);
      await patchStage(MANAGER_TAX, 'TERIMA', REASON).expect(200);

      const list = await getMessages(MANAGER_TAX).expect(200);

      expect(
        list.body.map(
          (m: { kind: string; reasonLabel: string | null }) => [
            m.kind,
            m.reasonLabel,
          ],
        ),
      ).toEqual([
        ['ALASAN', 'PENGAJUAN'],
        ['ALASAN', 'MENERIMA'],
      ]);
    });

    it('see a rejection reason labelled as such', async () => {
      await seedAt('MENUNGGU_MANAGER_TUJUAN');
      await patchStage(MANAGER_TAX, 'TOLAK', REASON).expect(200);

      const list = await getMessages(MANAGER_IT).expect(200);

      expect(list.body).toMatchObject([
        { kind: 'ALASAN', reasonLabel: 'MENOLAK', body: REASON },
      ]);
    });
  });

  describe('closed stages', () => {
    it.each<[TicketStage, TicketStage | undefined]>([
      ['MENUNGGU_MANAGER_ASAL', undefined],
      ['SELESAI', undefined],
      ['DITOLAK', 'MENUNGGU_MANAGER_TUJUAN'],
    ])('refuses to write at %s but still lets managers read', async (stage, rejectedAt) => {
      await seedAt(stage, rejectedAt);

      const response = await postMessage(MANAGER_IT, 'Terlambat');
      expect(response.status).toBe(409);
      await expect(messageCount()).resolves.toBe(0);
      await getMessages(MANAGER_IT).expect(200);
    });
  });

  describe('readers who must not get comments', () => {
    it.each([STAFF_IT, STAFF_TAX, MANAGER_LEGAL])(
      'answers 404 to %s on both read and write',
      async (fullName) => {
        await seedAt('DIPROSES');
        await prisma.ticketMessage.create({
          data: {
            ticketId: ITEM,
            authorId: idOf(MANAGER_IT),
            kind: 'KOMENTAR',
            body: 'Rahasia manajer',
          },
        });

        await getMessages(fullName).expect(404);
        await postMessage(fullName, 'Menyusup').expect(404);
        await expect(messageCount()).resolves.toBe(1);
      },
    );

    it('does not leak messages through the ticket detail', async () => {
      await seedAt('DIPROSES');
      await prisma.ticketMessage.create({
        data: {
          ticketId: ITEM,
          authorId: idOf(MANAGER_IT),
          kind: 'KOMENTAR',
          body: 'Rahasia manajer',
        },
      });

      const detail = await request(server())
        .get(`/tickets/${ITEM}`)
        .set('Cookie', as(STAFF_TAX))
        .expect(200);

      expect(JSON.stringify(detail.body)).not.toContain('Rahasia manajer');
      expect(detail.body.canReadComments).toBe(false);
      expect(detail.body.canComment).toBe(false);
    });

    it('answers the same 404 for a ticket that does not exist', async () => {
      await seedAt('DIPROSES');

      const missing = await request(server())
        .get('/tickets/IT-20261011-9999/messages')
        .set('Cookie', as(STAFF_IT))
        .expect(404);
      const hidden = await getMessages(STAFF_IT).expect(404);

      expect(hidden.body.message).toBe(missing.body.message);
    });
  });

  describe('superadmin', () => {
    it('reads but can never write', async () => {
      await seedAt('DIPROSES');
      await postMessage(MANAGER_IT, 'Komentar manajer').expect(201);

      await getMessages(SUPERADMIN).expect(200);
      await postMessage(SUPERADMIN, 'Tidak boleh').expect(404);

      await expect(messageCount()).resolves.toBe(1);
    });

    it('is told on the detail that it can read but not comment', async () => {
      await seedAt('DIPROSES');

      const detail = await request(server())
        .get(`/tickets/${ITEM}`)
        .set('Cookie', as(SUPERADMIN))
        .expect(200);

      expect(detail.body.canReadComments).toBe(true);
      expect(detail.body.canComment).toBe(false);
    });
  });

  describe('ticket detail flags for managers', () => {
    it.each([
      ['DIPROSES', true],
      ['SELESAI', false],
    ] as const)('at %s canComment is %s', async (stage, canComment) => {
      await seedAt(stage);

      const detail = await request(server())
        .get(`/tickets/${ITEM}`)
        .set('Cookie', as(MANAGER_TAX))
        .expect(200);

      expect(detail.body.canReadComments).toBe(true);
      expect(detail.body.canComment).toBe(canComment);
    });
  });

  describe('input handling', () => {
    beforeEach(async () => {
      await seedAt('DIPROSES');
    });

    it('stores markup as plain text without altering it', async () => {
      const payload = '<img src=x onerror=alert(1)>';

      const response = await postMessage(MANAGER_IT_VALIDATION, payload);

      expect(response.status).toBe(201);
      expect(response.body.body).toBe(payload);
      const stored = await prisma.ticketMessage.findFirstOrThrow({
        where: { ticketId: ITEM },
        select: { body: true },
      });
      expect(stored.body).toBe(payload);
    });

    it.each([
      ['an empty body', ''],
      ['a blank body', '   \n  '],
      ['a body over 1000 characters', 'a'.repeat(1001)],
      ['a bidi control character', 'komentar‮ tersamar'],
    ])('rejects %s with 400', async (_label, body) => {
      const response = await postMessage(MANAGER_IT_VALIDATION, body);

      expect(response.status).toBe(400);
      await expect(messageCount()).resolves.toBe(0);
    });

    it('rejects fields that try to set the kind or the author', async () => {
      const response = await postMessage(MANAGER_IT_VALIDATION, {
        body: 'Komentar',
        kind: 'ALASAN',
        authorId: idOf(MANAGER_TAX),
      });

      expect(response.status).toBe(400);
      await expect(messageCount()).resolves.toBe(0);
    });

    it('refuses cross-site requests', async () => {
      const response = await postMessage(MANAGER_IT, 'Dari situs lain').set(
        'Sec-Fetch-Site',
        'cross-site',
      );

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(CROSS_SITE_MESSAGE);
      await expect(messageCount()).resolves.toBe(0);
    });

    it('offers no way to edit or delete a message', async () => {
      const created = await postMessage(MANAGER_IT, 'Final').expect(201);

      await request(server())
        .patch(`/tickets/${ITEM}/messages/${created.body.id}`)
        .set('Cookie', as(MANAGER_IT))
        .send({ body: 'Diubah' })
        .expect(404);
      await request(server())
        .delete(`/tickets/${ITEM}/messages/${created.body.id}`)
        .set('Cookie', as(MANAGER_IT))
        .expect(404);
    });
  });

  describe('limit of 100 messages per ticket', () => {
    it('refuses the 101st message with 409', async () => {
      await seedAt('DIPROSES');
      await seedBulk(100);

      const response = await postMessage(MANAGER_TAX_LIMIT, 'Pesan ke-101');

      expect(response.status).toBe(409);
      await expect(messageCount()).resolves.toBe(100);
    });

    it('accepts the 100th message', async () => {
      await seedAt('DIPROSES');
      await seedBulk(99);

      await postMessage(MANAGER_TAX_LIMIT, 'Pesan ke-100').expect(201);

      await expect(messageCount()).resolves.toBe(100);
    });

    it('counts decision reasons together with comments', async () => {
      await seedAt('MENUNGGU_MANAGER_TUJUAN');
      await seedBulk(99);
      await prisma.ticketMessage.create({
        data: {
          ticketId: ITEM,
          authorId: idOf(MANAGER_IT),
          kind: 'ALASAN',
          body: REASON,
        },
      });

      await postMessage(MANAGER_TAX_LIMIT, 'Kelebihan').expect(409);
    });

    it('lets only as many concurrent comments through as there is room for', async () => {
      await seedAt('DIPROSES');
      await seedBulk(98);

      const responses = await Promise.all(
        Array.from({ length: 5 }, (_, index) =>
          postMessage(MANAGER_TAX_LIMIT, `Balapan ${index}`),
        ),
      );

      expect(responses.filter((r) => r.status === 201)).toHaveLength(2);
      expect(
        responses.filter((r) => r.status !== 201).every((r) => r.status === 409),
      ).toBe(true);
      await expect(messageCount()).resolves.toBe(100);
    });
  });
});

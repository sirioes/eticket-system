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
import { readZipEntry } from '../fixtures/xlsx';
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

const XLSX_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const STAFF_IT = 'Staf IT DB11';
const MANAGER_IT = 'Manager IT DB12';
const STAFF_TAX = 'Staf Tax DB13';
const MANAGER_TAX = 'Manager Tax DB14';
const STAFF_LEGAL = 'Staf Legal DB15';
const SUPERADMIN = 'Super Admin DB16';
const THROTTLED = 'Staf Tax DB17';

const REASON_ORIGIN = 'Kebutuhan sudah jelas dan mendesak';
const REASON_DESTINATION = 'Dapat dikerjakan minggu ini';

const ACCOUNTS = [
  [STAFF_IT, Role.TEAM_MAIN_OFFICE, Divisi.IT],
  [MANAGER_IT, Role.MANAGER_MAIN_OFFICE, Divisi.IT],
  [STAFF_TAX, Role.TEAM_MAIN_OFFICE, Divisi.TAX],
  [MANAGER_TAX, Role.MANAGER_MAIN_OFFICE, Divisi.TAX],
  [STAFF_LEGAL, Role.TEAM_MAIN_OFFICE, Divisi.LEGAL],
  [SUPERADMIN, Role.SUPERADMIN, null],
  [THROTTLED, Role.TEAM_MAIN_OFFICE, Divisi.TAX],
] as const;

describe('Ticket detail export on MySQL', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cookies = new Map<string, string>();
  const ids = new Map<string, number>();

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

  const exportDetail = (fullName: string, ticketId = ITEM) =>
    request(server())
      .get(`/tickets/${ticketId}/export`)
      .set('Cookie', as(fullName))
      .responseType('blob');

  const patchStage = (fullName: string, action: string, reason: string) =>
    request(server())
      .patch(`/tickets/${ITEM}/stage`)
      .set('Cookie', as(fullName))
      .send({ action, reason });

  const seedAt = (stage: TicketStage) =>
    seedTicket(prisma, {
      id: ITEM,
      fromDivisi: Divisi.IT,
      toDivisi: Divisi.TAX,
      createdById: idOf(STAFF_IT),
      stage,
    });

  const seedReviewed = async (
    reasonOrigin = REASON_ORIGIN,
    reasonDestination = REASON_DESTINATION,
  ) => {
    await seedAt('MENUNGGU_MANAGER_ASAL');
    await patchStage(MANAGER_IT, 'TERIMA', reasonOrigin).expect(200);
    await patchStage(MANAGER_TAX, 'TERIMA', reasonDestination).expect(200);
  };

  const sheets = (body: Buffer) => ({
    information: readZipEntry(body, 'xl/worksheets/sheet1.xml'),
    history: readZipEntry(body, 'xl/worksheets/sheet2.xml'),
    strings: readZipEntry(body, 'xl/sharedStrings.xml'),
    workbook: readZipEntry(body, 'xl/workbook.xml'),
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

  describe('who receives the reason column', () => {
    it.each([
      ['the origin manager', MANAGER_IT],
      ['the destination manager', MANAGER_TAX],
      ['the superadmin', SUPERADMIN],
    ])('adds the reasons to the file of %s', async (_label, who) => {
      await seedReviewed();

      const response = await exportDetail(who);

      expect(response.status).toBe(200);
      const { history, strings } = sheets(response.body);
      expect(strings).toContain('<t>Alasan</t>');
      expect(strings).toContain(`<t>${REASON_ORIGIN}</t>`);
      expect(strings).toContain(`<t>${REASON_DESTINATION}</t>`);
      expect(history).toMatch(/r="E1"/);
    });

    it.each([
      ['the origin staff', STAFF_IT],
      ['the destination staff', STAFF_TAX],
    ])('leaves the reasons out of the file of %s', async (_label, who) => {
      await seedReviewed();

      const response = await exportDetail(who);

      expect(response.status).toBe(200);
      const { history, strings } = sheets(response.body);
      expect(strings).not.toContain('<t>Alasan</t>');
      expect(strings).not.toContain(REASON_ORIGIN);
      expect(strings).not.toContain(REASON_DESTINATION);
      expect(history).not.toMatch(/r="E\d+"/);
    });
  });

  describe('file content', () => {
    it('is served as a download with the hardening headers', async () => {
      await seedReviewed();

      const response = await exportDetail(MANAGER_IT);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain(XLSX_TYPE);
      expect(response.headers['content-disposition']).toMatch(/^attachment/);
      expect(response.headers['content-disposition']).toContain(`${ITEM}.xlsx`);
      expect(response.headers['content-security-policy']).toBe(
        "default-src 'none'; sandbox",
      );
      expect(response.headers['cache-control']).toContain('no-store');
    });

    it('has the Informasi and Riwayat sheets with readable division labels', async () => {
      await seedReviewed();

      const response = await exportDetail(MANAGER_IT);

      const { workbook, strings } = sheets(response.body);
      expect(workbook).toContain('name="Informasi"');
      expect(workbook).toContain('name="Riwayat"');
      for (const text of [
        ITEM,
        'IT',
        'Pajak',
        'Diterima',
        'Dibuat',
        'Disetujui Manajer Divisi IT',
        'Diterima Manajer Divisi Pajak',
        MANAGER_IT,
        MANAGER_TAX,
      ]) {
        expect(strings).toContain(`<t>${text}</t>`);
      }
      expect(strings).not.toContain('<t>TAX</t>');
    });

    it('writes one history row per stage log in order', async () => {
      await seedReviewed();

      const response = await exportDetail(MANAGER_IT);

      const { history } = sheets(response.body);
      expect(history).toMatch(/r="A4"/);
      expect(history).not.toMatch(/r="A5"/);
    });

    it('never turns free text into a formula', async () => {
      const formula = '=HYPERLINK("http://x","klik")';
      await seedReviewed(
        '=cmd|calc untuk alasan asal',
        '+SUM(1+1) alasan tujuan',
      );
      await prisma.ticket.update({
        where: { id: ITEM },
        data: { description: formula },
      });

      const response = await exportDetail(SUPERADMIN);

      expect(response.status).toBe(200);
      const { information, history, strings } = sheets(response.body);
      expect(information).not.toContain('<f>');
      expect(history).not.toContain('<f>');
      expect(strings).toContain(`<t>${formula}</t>`);
      expect(strings).toContain('<t>=cmd|calc untuk alasan asal</t>');
      expect(strings).toContain('<t>+SUM(1+1) alasan tujuan</t>');
    });
  });

  describe('who may export', () => {
    it('answers 404 to a division that may not open the ticket', async () => {
      await seedReviewed();

      await exportDetail(STAFF_LEGAL).expect(404);
    });

    it('answers 404 to the destination staff before the ticket reaches them', async () => {
      await seedAt('MENUNGGU_MANAGER_ASAL');

      await exportDetail(STAFF_TAX).expect(404);
    });

    it('answers 404 for a ticket that does not exist', async () => {
      await exportDetail(STAFF_LEGAL, 'IT-20261011-9999').expect(404);
    });

    it('refuses a cross-site request', async () => {
      await seedReviewed();

      const response = await request(server())
        .get(`/tickets/${ITEM}/export`)
        .set('Cookie', as(STAFF_LEGAL))
        .set('Sec-Fetch-Site', 'cross-site');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(CROSS_SITE_MESSAGE);
    });

    it('limits export requests to 5 per minute per user', async () => {
      await seedReviewed();

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await exportDetail(THROTTLED).expect(200);
      }
      await exportDetail(THROTTLED).expect(429);
    });
  });

  describe('existing routes', () => {
    it('keeps the outgoing export on its own route', async () => {
      await seedReviewed();

      const response = await request(server())
        .get('/tickets/outgoing/export')
        .set('Cookie', as(STAFF_IT))
        .responseType('blob');

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toContain(
        'pengaduan-keluar-IT-',
      );
      expect(readZipEntry(response.body, 'xl/workbook.xml')).toContain(
        'name="Pengaduan Keluar"',
      );
    });
  });
});

import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { ACCESS_TOKEN_COOKIE } from '../../src/auth/auth.constants';
import { Divisi } from '../../src/common/enums/divisi.enum';
import { Role } from '../../src/common/enums/role.enum';
import { CROSS_SITE_MESSAGE } from '../../src/common/guards/fetch-metadata.guard';
import { TicketStage } from '../../src/generated/prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TicketStageRepository } from '../../src/tickets/application/ports/ticket-stage.repository';
import {
  DOCX,
  EXE,
  JPEG,
  padded,
  PDF,
  PNG,
  SVG,
  WEBP,
  XLSX,
  ZIP,
} from '../fixtures/files';
import {
  assertTestDatabase,
  resetDatabase,
  resetTickets,
  seedTicket,
  seedUser,
} from './test-database';

const UPLOAD_DIR = mkdtempSync(path.join(os.tmpdir(), 'eticket-completion-'));

process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.COOKIE_SECURE = 'false';
process.env.CORS_ORIGIN = 'https://eticket.example';
process.env.UPLOAD_DIR = UPLOAD_DIR;

const ITEM = 'IT-20261011-0001';

const MEGABYTE = 1024 * 1024;

const STAFF_IT = 'Staf IT DB11';
const MANAGER_IT = 'Manager IT DB12';
const STAFF_TAX = 'Staf Tax DB13';
const THROTTLED = 'Staf Tax DB17';
const COMPLETERS = Array.from(
  { length: 8 },
  (_, index) => `Staf Tax DB2${index}`,
);
const MANAGER_TAX = 'Manager Tax DB14';
const STAFF_LEGAL = 'Staf Legal DB15';
const SUPERADMIN = 'Super Admin DB16';

const ACCEPTED = [
  ['PDF', 'laporan.pdf', PDF, 'application/pdf'],
  [
    'xlsx',
    'LPJ.xlsx',
    XLSX,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  [
    'docx',
    'CAPEX.docx',
    DOCX,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  ['PNG', 'foto.png', PNG, 'image/png'],
  ['JPEG', 'foto.jpg', JPEG, 'image/jpeg'],
  ['WebP', 'foto.webp', WEBP, 'image/webp'],
] as const;

const REJECTED = [
  ['an executable renamed to docx', 'laporan.docx', EXE],
  ['a plain zip renamed to xlsx', 'LPJ.xlsx', ZIP],
  ['an svg with an svg extension', 'logo.svg', SVG],
  ['an svg disguised as png', 'foto.png', SVG],
  ['a pdf renamed to docx', 'laporan.docx', PDF],
  ['an old Excel extension', 'LPJ.xls', XLSX],
  ['a file without extension', 'laporan', PDF],
] as const;

describe('Completion files on MySQL', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cookies = new Map<string, string>();
  const ids = new Map<string, number>();

  const ACCOUNTS = [
    [STAFF_IT, Role.TEAM_MAIN_OFFICE, Divisi.IT],
    [MANAGER_IT, Role.MANAGER_MAIN_OFFICE, Divisi.IT],
    [STAFF_TAX, Role.TEAM_MAIN_OFFICE, Divisi.TAX],
    [MANAGER_TAX, Role.MANAGER_MAIN_OFFICE, Divisi.TAX],
    [STAFF_LEGAL, Role.TEAM_MAIN_OFFICE, Divisi.LEGAL],
    [SUPERADMIN, Role.SUPERADMIN, null],
    [THROTTLED, Role.TEAM_MAIN_OFFICE, Divisi.TAX],
    ...COMPLETERS.map(
      (name) => [name, Role.TEAM_MAIN_OFFICE, Divisi.TAX] as const,
    ),
  ] as const;

  let completerName = STAFF_TAX;
  let completerTurn = 0;
  const completer = () => completerName;

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

  type Upload = readonly [name: string, content: Buffer];

  const complete = (fullName: string, uploads: readonly Upload[] = []) => {
    const req = request(server())
      .post(`/tickets/${ITEM}/complete`)
      .set('Cookie', as(fullName));
    for (const [name, content] of uploads) req.attach('files', content, name);
    return req;
  };

  const completeWithEmptyMultipart = (fullName: string) =>
    request(server())
      .post(`/tickets/${ITEM}/complete`)
      .set('Cookie', as(fullName))
      .set('Content-Type', 'multipart/form-data; boundary=kosong')
      .send('--kosong--\r\n');

  const completeWithoutBody = (fullName: string) =>
    request(server())
      .post(`/tickets/${ITEM}/complete`)
      .set('Cookie', as(fullName));

  const getDetail = (fullName: string) =>
    request(server()).get(`/tickets/${ITEM}`).set('Cookie', as(fullName));

  const download = (fullName: string, fileId: string, ticketId = ITEM) =>
    request(server())
      .get(`/tickets/${ticketId}/completion-files/${fileId}`)
      .set('Cookie', as(fullName))
      .responseType('blob');

  const patchStage = (fullName: string, action: string) =>
    request(server())
      .patch(`/tickets/${ITEM}/stage`)
      .set('Cookie', as(fullName))
      .send({ action });

  const uploadAttachment = (fullName: string, upload: Upload) =>
    request(server())
      .post(`/tickets/${ITEM}/attachments`)
      .set('Cookie', as(fullName))
      .attach('file', upload[1], upload[0]);

  const filesOnDisk = () => readdir(UPLOAD_DIR);

  const stageOf = async () =>
    (await prisma.ticket.findUniqueOrThrow({ where: { id: ITEM } })).stage;

  const storedCount = () =>
    prisma.ticketCompletionFile.count({ where: { ticketId: ITEM } });

  const seedAt = (stage: TicketStage, rejectedAtStage?: TicketStage) =>
    seedTicket(prisma, {
      id: ITEM,
      fromDivisi: Divisi.IT,
      toDivisi: Divisi.TAX,
      createdById: idOf(STAFF_IT),
      stage,
      rejectedAtStage: rejectedAtStage ?? null,
    });

  const expectUntouched = async (stage: TicketStage) => {
    expect(await stageOf()).toBe(stage);
    expect(await storedCount()).toBe(0);
    expect(await filesOnDisk()).toEqual([]);
  };

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
    await rm(UPLOAD_DIR, { recursive: true, force: true });
  });

  beforeEach(async () => {
    completerName = COMPLETERS[completerTurn++ % COMPLETERS.length];
    await resetTickets(prisma);
    for (const name of await filesOnDisk()) {
      await rm(path.join(UPLOAD_DIR, name), { force: true });
    }
  });

  describe('completing without documents', () => {
    it.each([
      ['a multipart request without any file part', completeWithEmptyMultipart],
      ['a request without a multipart body', completeWithoutBody],
    ])('moves the ticket to SELESAI with %s', async (_label, send) => {
      await seedAt('DIPROSES');

      const response = await send(completer());

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ id: ITEM, stage: 'SELESAI' });
      expect(await stageOf()).toBe('SELESAI');
      expect(await storedCount()).toBe(0);
      const log = await prisma.ticketStageLog.findMany({
        where: { ticketId: ITEM, action: 'SELESAI' },
      });
      expect(log).toHaveLength(1);
    });
  });

  describe('completing with documents', () => {
    it.each(ACCEPTED)(
      'accepts a %s document, stores it and serves it back',
      async (_label, name, content, mimeType) => {
        await seedAt('DIPROSES');

        const response = await complete(completer(), [[name, content]]);

        expect(response.status).toBe(201);
        expect(await stageOf()).toBe('SELESAI');
        const [row] = await prisma.ticketCompletionFile.findMany({
          where: { ticketId: ITEM },
        });
        expect(row).toMatchObject({
          fileName: name,
          mimeType,
          size: content.length,
          uploadedById: idOf(completer()),
        });
        expect(row.storedName).toMatch(/^[0-9a-f-]{36}$/);
        expect(await filesOnDisk()).toEqual([row.storedName]);

        const served = await download(STAFF_TAX, row.id);
        expect(served.status).toBe(200);
        expect(served.headers['content-type']).toContain(mimeType);
        expect(Buffer.compare(served.body as Buffer, content)).toBe(0);
      },
    );

    it('accepts five documents and lists them in the detail', async () => {
      await seedAt('DIPROSES');
      const uploads = [1, 2, 3, 4, 5].map((n): Upload => [
        `dokumen-${n}.pdf`,
        PDF,
      ]);

      await complete(completer(), uploads).expect(201);

      expect(await storedCount()).toBe(5);
      expect(await filesOnDisk()).toHaveLength(5);
      const detail = await getDetail(STAFF_TAX).expect(200);
      expect(detail.body.completionFiles).toHaveLength(5);
      expect(detail.body.completionFiles[0]).toEqual({
        id: expect.any(String),
        fileName: 'dokumen-1.pdf',
        mimeType: 'application/pdf',
        size: PDF.length,
        createdAt: expect.any(String),
        uploadedBy: { fullName: completer(), divisi: Divisi.TAX },
      });
      expect(JSON.stringify(detail.body.completionFiles)).not.toContain(
        'storedName',
      );
    });

    it('refuses the sixth document and leaves the ticket untouched', async () => {
      await seedAt('DIPROSES');
      const uploads = [1, 2, 3, 4, 5, 6].map((n): Upload => [
        `dokumen-${n}.pdf`,
        PDF,
      ]);

      await complete(completer(), uploads).expect(400);

      await expectUntouched('DIPROSES');
    });

    it('accepts a document of exactly 10 MB', async () => {
      await seedAt('DIPROSES');

      await complete(completer(), [
        ['besar.pdf', padded(PDF, 10 * MEGABYTE)],
      ]).expect(201);

      expect(await storedCount()).toBe(1);
    });

    it('refuses a document above 10 MB and removes it from disk', async () => {
      await seedAt('DIPROSES');

      await complete(completer(), [
        ['besar.pdf', padded(PDF, 10 * MEGABYTE + 1)],
      ]).expect(413);

      await expectUntouched('DIPROSES');
    });

    it.each(REJECTED)(
      'refuses %s and removes every uploaded file from disk',
      async (_label, name, content) => {
        await seedAt('DIPROSES');

        await complete(completer(), [
          ['sah.pdf', PDF],
          [name, content],
        ]).expect(400);

        await expectUntouched('DIPROSES');
      },
    );
  });

  describe('attachments endpoint', () => {
    it.each([
      ['an svg with an svg extension', 'logo.svg'],
      ['an svg disguised as png', 'foto.png'],
    ])('refuses %s and removes it from disk', async (_label, name) => {
      await seedAt('MENUNGGU_MANAGER_ASAL');

      await uploadAttachment(STAFF_IT, [name, SVG]).expect(400);

      expect(await prisma.ticketAttachment.count()).toBe(0);
      expect(await filesOnDisk()).toEqual([]);
    });

    it('keeps its 5 MB limit', async () => {
      await seedAt('MENUNGGU_MANAGER_ASAL');

      await uploadAttachment(STAFF_IT, [
        'besar.pdf',
        padded(PDF, 5 * MEGABYTE + 1),
      ]).expect(413);
    });
  });

  describe('who may complete', () => {
    it.each([
      [MANAGER_TAX, 403],
      [STAFF_IT, 403],
      [MANAGER_IT, 403],
      [SUPERADMIN, 403],
      [STAFF_LEGAL, 404],
    ])(
      'answers %s with %i before any file reaches the disk',
      async (name, status) => {
        await seedAt('DIPROSES');

        await complete(name, [['laporan.pdf', PDF]]).expect(status);

        await expectUntouched('DIPROSES');
      },
    );

    it('limits completion requests to 10 per minute per user', async () => {
      await seedAt('MENUNGGU_MANAGER_ASAL');

      for (let attempt = 0; attempt < 10; attempt++) {
        await complete(THROTTLED).expect(404);
      }
      await complete(THROTTLED).expect(429);
    });

    it('answers 404 for a ticket that does not exist', async () => {
      await complete(completer(), [['laporan.pdf', PDF]]).expect(404);

      expect(await filesOnDisk()).toEqual([]);
    });

    it('refuses a cross-site request before any file reaches the disk', async () => {
      await seedAt('DIPROSES');

      const response = await complete(completer(), [['laporan.pdf', PDF]]).set(
        'Sec-Fetch-Site',
        'cross-site',
      );

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(CROSS_SITE_MESSAGE);
      await expectUntouched('DIPROSES');
    });

    it.each<[TicketStage, number, TicketStage?]>([
      ['MENUNGGU_MANAGER_ASAL', 404, undefined],
      ['MENUNGGU_MANAGER_TUJUAN', 404, undefined],
      ['MENUNGGU_STAF_TUJUAN', 409, undefined],
      ['SELESAI', 403, undefined],
      ['DITOLAK', 403, 'MENUNGGU_MANAGER_TUJUAN'],
    ])(
      'refuses to complete a ticket at %s with %i',
      async (stage, status, rejectedAt) => {
        await seedAt(stage, rejectedAt);

        await complete(completer(), [['laporan.pdf', PDF]]).expect(status);

        await expectUntouched(stage);
      },
    );

    it('refuses the SELESAI action on the stage endpoint', async () => {
      await seedAt('DIPROSES');

      await patchStage(completer(), 'SELESAI').expect(400);

      expect(await stageOf()).toBe('DIPROSES');
    });

    it('lets only one of two simultaneous requests win and keeps only its files', async () => {
      await seedAt('DIPROSES');

      const [first, second] = await Promise.all([
        complete(completer(), [['pertama.pdf', PDF]]),
        complete(completer(), [['kedua.pdf', PDF]]),
      ]);

      const statuses = [first.status, second.status].sort();
      expect(statuses[0]).toBe(201);
      expect([403, 409]).toContain(statuses[1]);
      expect(await stageOf()).toBe('SELESAI');
      expect(await storedCount()).toBe(1);
      expect(await filesOnDisk()).toHaveLength(1);
    });
  });

  describe('atomicity', () => {
    it('rolls back the stage change and the log when storing a document fails', async () => {
      await seedAt('DIPROSES');
      const stages = app.get(TicketStageRepository);

      await expect(
        stages.advanceStage({
          ticketId: ITEM,
          expectedStage: 'DIPROSES',
          action: 'SELESAI',
          nextStage: 'SELESAI',
          actorId: idOf(completer()),
          reason: null,
          completionFiles: [
            {
              fileName: 'a'.repeat(1000),
              storedName: '3f2b8c1e-5a47-4d9b-8e60-1c2d3e4f5a61',
              mimeType: 'application/pdf',
              size: 10,
            },
          ],
        }),
      ).rejects.toThrow();

      expect(await stageOf()).toBe('DIPROSES');
      expect(
        await prisma.ticketStageLog.count({
          where: { ticketId: ITEM, action: 'SELESAI' },
        }),
      ).toBe(0);
      expect(await storedCount()).toBe(0);
    });
  });

  describe('downloading', () => {
    const completeWithOne = async () => {
      await seedAt('DIPROSES');
      await complete(completer(), [['LPJ.xlsx', XLSX]]).expect(201);
      const row = await prisma.ticketCompletionFile.findFirstOrThrow({
        where: { ticketId: ITEM },
      });
      return row.id;
    };

    it.each([STAFF_IT, MANAGER_IT, STAFF_TAX, MANAGER_TAX, SUPERADMIN])(
      'serves the file to %s',
      async (name) => {
        const fileId = await completeWithOne();

        const response = await download(name, fileId);

        expect(response.status).toBe(200);
        expect(Buffer.compare(response.body as Buffer, XLSX)).toBe(0);
      },
    );

    it('is never inline and carries the hardening headers', async () => {
      const fileId = await completeWithOne();

      const response = await download(STAFF_TAX, fileId);

      expect(response.headers['content-disposition']).toMatch(
        /^attachment; filename="LPJ\.xlsx"/,
      );
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['content-security-policy']).toBe(
        "default-src 'none'; sandbox",
      );
      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.headers['cache-control']).toContain('private');
    });

    it('answers 404 to a division that may not open the ticket', async () => {
      const fileId = await completeWithOne();

      await download(STAFF_LEGAL, fileId).expect(404);
    });

    it('answers 404 for an unknown file and for a file under another ticket id', async () => {
      const fileId = await completeWithOne();

      await download(STAFF_TAX, '0b6f4e4e-0d6e-4c2d-9a63-3a2f0f5f8f11').expect(
        404,
      );
      await download(STAFF_TAX, fileId, 'IT-20261011-9999').expect(404);
    });

    it('answers 400 for a malformed file id', async () => {
      await completeWithOne();

      await download(STAFF_TAX, 'bukan-uuid').expect(400);
    });
  });

  describe('attachment counts', () => {
    it('are not affected by completion files', async () => {
      await seedAt('DIPROSES');
      await prisma.ticketAttachment.createMany({
        data: [1, 2].map((n) => ({
          ticketId: ITEM,
          fileName: `lampiran-${n}.png`,
          storedName: `3f2b8c1e-5a47-4d9b-8e60-1c2d3e4f5b6${n}`,
          mimeType: 'image/png',
          size: 100,
          uploadedById: idOf(STAFF_IT),
        })),
      });

      await complete(completer(), [
        ['a.pdf', PDF],
        ['b.pdf', PDF],
        ['c.pdf', PDF],
      ]).expect(201);

      const detail = await getDetail(STAFF_TAX).expect(200);
      expect(detail.body.attachments).toHaveLength(2);
      expect(detail.body.completionFiles).toHaveLength(3);
      const incoming = await request(server())
        .get('/tickets/incoming')
        .set('Cookie', as(STAFF_TAX))
        .expect(200);
      expect(incoming.body.items[0].attachmentCount).toBe(2);
    });
  });
});

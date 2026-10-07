import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Readable } from 'node:stream';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { TicketStage } from '../../generated/prisma/client';
import { AppModule } from '../../app.module';
import { configureApp } from '../../app.setup';
import { UserRepository } from '../../auth/application/ports/user.repository';
import { FORBIDDEN_MESSAGE } from '../../auth/auth.constants';
import { UserCredentials } from '../../auth/domain/auth-user';
import { Divisi } from '../../common/enums/divisi.enum';
import { Role } from '../../common/enums/role.enum';
import {
  APNG,
  EXE,
  HTML,
  JPEG,
  padded,
  PDF,
  PNG,
  WEBP,
} from '../../../test/fixtures/files';
import {
  DuplicateTicketIdError,
  NewTicket,
  TicketRepository,
} from '../application/ports/ticket.repository';
import {
  AttachmentRepository,
  DownloadableAttachment,
  LockedTicket,
  NewAttachment,
  UploadContentionError,
  UploadTarget,
} from './application/ports/attachment.repository';
import { DiskAttachmentFileStore } from './infrastructure/disk-attachment-file-store';
import { ATTACHMENT_NOT_FOUND_MESSAGE } from './application/use-cases/download-attachment.use-case';
import {
  ATTACHMENT_LIMIT_MESSAGE,
  STAGE_LOCKED_MESSAGE,
  TICKET_NOT_FOUND_MESSAGE,
  UPLOAD_BUSY_MESSAGE,
} from './application/use-cases/upload-attachment.use-case';
import { FILE_REQUIRED_MESSAGE } from './presentation/attachments.controller';
import {
  MAX_ATTACHMENT_BYTES,
  UNSUPPORTED_FILE_TYPE_MESSAGE,
} from './domain/attachment-rules';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class {
    $queryRaw = jest.fn().mockResolvedValue([1]);
  },
}));

process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.COOKIE_SECURE = 'false';
process.env.CORS_ORIGIN = 'https://eticket.example';

const PASSWORD = 'rahasia-integrasi-123';
const STORED_NAME = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

class InMemoryUserRepository extends UserRepository {
  constructor(private readonly users: UserCredentials[]) {
    super();
  }

  async findCredentialsByFullName(normalizedFullName: string) {
    const wanted = normalizedFullName.toLowerCase();
    return (
      this.users.find((user) => user.fullName.toLowerCase() === wanted) ?? null
    );
  }

  async findAuthUserById(id: number) {
    const found = this.users.find((user) => user.id === id);
    if (!found) return null;
    const { passwordHash: _passwordHash, ...authUser } = found;
    return authUser;
  }

  async findCredentialsById(id: number) {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async updatePassword() {
    throw new Error('tidak dipakai di test ini');
  }
}

class InMemoryTicketRepository extends TicketRepository {
  readonly stored: NewTicket[] = [];

  async findLatestIdWithPrefix(prefix: string) {
    const ids = this.stored
      .map((ticket) => ticket.id)
      .filter((id) => id.startsWith(prefix))
      .sort();
    return ids.at(-1) ?? null;
  }

  async insert(ticket: NewTicket) {
    if (this.stored.some((existing) => existing.id === ticket.id)) {
      throw new DuplicateTicketIdError(ticket.id);
    }
    this.stored.push(ticket);
  }
}

class InMemoryAttachmentRepository extends AttachmentRepository {
  readonly saved: (NewAttachment & { ticketId: string })[] = [];
  readonly stages = new Map<string, TicketStage>();
  readonly rejectedAt = new Map<string, TicketStage>();
  private readonly chains = new Map<string, Promise<unknown>>();

  constructor(private readonly tickets: InMemoryTicketRepository) {
    super();
  }

  private ownedBy(ticketId: string, uploaderId: number) {
    const ticket = this.tickets.stored.find((t) => t.id === ticketId);
    return ticket?.createdById === uploaderId ? ticket : undefined;
  }

  private stageOf(ticketId: string): TicketStage {
    return this.stages.get(ticketId) ?? 'MENUNGGU_MANAGER_ASAL';
  }

  async findUploadTarget(
    ticketId: string,
    uploaderId: number,
  ): Promise<UploadTarget | null> {
    if (!this.ownedBy(ticketId, uploaderId)) return null;
    return {
      stage: this.stageOf(ticketId),
      attachmentCount: this.saved.filter((a) => a.ticketId === ticketId).length,
    };
  }

  async findForDownload(
    ticketId: string,
    attachmentId: string,
  ): Promise<DownloadableAttachment | null> {
    const index = this.saved.findIndex(
      (a, i) => a.ticketId === ticketId && `att-${i + 1}` === attachmentId,
    );
    const ticket = this.tickets.stored.find((t) => t.id === ticketId);
    if (index === -1 || !ticket) return null;
    const attachment = this.saved[index];
    return {
      fileName: attachment.fileName,
      storedName: attachment.storedName,
      mimeType: attachment.mimeType,
      ticket: {
        fromDivisi: ticket.fromDivisi,
        toDivisi: ticket.toDivisi,
        stage: this.stageOf(ticketId),
        rejectedAtStage: this.rejectedAt.get(ticketId) ?? null,
      },
    };
  }

  withLockedTicket<T extends object>(
    ticketId: string,
    uploaderId: number,
    work: (ticket: LockedTicket) => Promise<T>,
  ): Promise<T | null> {
    const previous = this.chains.get(ticketId) ?? Promise.resolve();
    const run = previous.then(async () => {
      if (!this.ownedBy(ticketId, uploaderId)) return null;
      return work({
        stage: this.stageOf(ticketId),
        countAttachments: async () =>
          this.saved.filter((a) => a.ticketId === ticketId).length,
        insert: async (attachment) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          this.saved.push({ ...attachment, ticketId });
          return {
            id: `att-${this.saved.length}`,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType,
            size: attachment.size,
          };
        },
      });
    });
    this.chains.set(
      ticketId,
      run.catch(() => undefined),
    );
    return run;
  }
}

describe('Attachments (integration)', () => {
  let passwordHash: string;
  let app: INestApplication;
  let tickets: InMemoryTicketRepository;
  let attachments: InMemoryAttachmentRepository;
  let uploadRoot: string;
  let uploadDir: string;

  const account = (
    id: number,
    fullName: string,
    role: Role,
    divisi: Divisi | null,
  ): UserCredentials => ({
    id,
    fullName,
    role,
    divisi,
    isActive: true,
    passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
    passwordHash,
  });

  const server = () => app.getHttpServer();
  const filesOnDisk = async () => readdir(uploadDir).catch(() => []);

  const loginCookie = async (fullName: string) => {
    const response = await request(server())
      .post('/auth/login')
      .send({ fullName, password: PASSWORD })
      .expect(200);
    const header = response.headers['set-cookie'];
    return (Array.isArray(header) ? header : [header])[0].split(';')[0];
  };

  const createTicketAs = async (fullName: string, toDivisi: Divisi) => {
    const response = await request(server())
      .post('/tickets')
      .set('Cookie', await loginCookie(fullName))
      .send({ toDivisi, description: 'Printer lantai 2 tidak bisa mencetak' })
      .expect(201);
    return response.body.id as string;
  };

  const upload = async (
    cookie: string,
    ticketId: string,
    content: Buffer,
    options: { filename?: string; contentType?: string; field?: string } = {},
  ) =>
    request(server())
      .post(`/tickets/${encodeURIComponent(ticketId)}/attachments`)
      .set('Cookie', cookie)
      .attach(options.field ?? 'file', content, {
        filename: options.filename ?? 'bukti.png',
        contentType: options.contentType ?? 'image/png',
      });

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(PASSWORD, 10);
  });

  beforeEach(async () => {
    uploadRoot = await mkdtemp(path.join(os.tmpdir(), 'eticket-upload-'));
    uploadDir = path.join(uploadRoot, 'uploads');
    process.env.UPLOAD_DIR = uploadDir;

    tickets = new InMemoryTicketRepository();
    attachments = new InMemoryAttachmentRepository(tickets);

    const users = new InMemoryUserRepository([
      account(1, 'Staf IT IT01', Role.TEAM_MAIN_OFFICE, Divisi.IT),
      account(2, 'Staf IT IT02', Role.TEAM_MAIN_OFFICE, Divisi.IT),
      account(3, 'Manager Legal LG01', Role.MANAGER_MAIN_OFFICE, Divisi.LEGAL),
      account(4, 'Staf Finance FN01', Role.FINANCE_MAIN_OFFICE, Divisi.FINANCE),
      account(5, 'Super Admin SA01', Role.SUPERADMIN, null),
      account(6, 'Manager IT IT03', Role.MANAGER_MAIN_OFFICE, Divisi.IT),
      account(7, 'Staf Tax TX01', Role.TEAM_MAIN_OFFICE, Divisi.TAX),
      account(8, 'Manager Tax TX02', Role.MANAGER_MAIN_OFFICE, Divisi.TAX),
    ]);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(UserRepository)
      .useValue(users)
      .overrideProvider(TicketRepository)
      .useValue(tickets)
      .overrideProvider(AttachmentRepository)
      .useValue(attachments)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await app.close();
    await rm(uploadRoot, { recursive: true, force: true });
  });

  describe('GET /tickets/:ticketId/attachments/:attachmentId', () => {
    const attachmentUrl = (ticketId: string, attachmentId: string) =>
      `/tickets/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(attachmentId)}`;

    const ticketWithAttachment = async (
      content: Buffer = PDF,
      filename = 'laporan.pdf',
      contentType = 'application/pdf',
    ) => {
      const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);
      const uploaded = await upload(
        await loginCookie('Staf IT IT01'),
        ticketId,
        content,
        { filename, contentType },
      );
      expect(uploaded.status).toBe(201);
      return { ticketId, attachmentId: uploaded.body.id as string };
    };

    const download = async (
      name: string,
      ticketId: string,
      attachmentId: string,
    ) =>
      request(server())
        .get(attachmentUrl(ticketId, attachmentId))
        .set('Cookie', await loginCookie(name))
        .buffer(true)
        .parse((res, done) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => done(null, Buffer.concat(chunks)));
        });

    it('requires a session', async () => {
      const { ticketId, attachmentId } = await ticketWithAttachment();

      const response = await request(server()).get(
        attachmentUrl(ticketId, attachmentId),
      );

      expect(response.status).toBe(401);
    });

    it('returns the exact bytes to the creator', async () => {
      const { ticketId, attachmentId } = await ticketWithAttachment();

      const response = await download('Staf IT IT01', ticketId, attachmentId);

      expect(response.status).toBe(200);
      expect(Buffer.compare(response.body as Buffer, PDF)).toBe(0);
      expect(response.headers['content-length']).toBe(String(PDF.length));
    });

    it('sends headers that force a download and block content sniffing', async () => {
      const { ticketId, attachmentId } = await ticketWithAttachment(
        PNG,
        'bukti é.png',
        'image/png',
      );

      const response = await download('Staf IT IT01', ticketId, attachmentId);

      expect(response.headers['content-type']).toBe('image/png');
      expect(response.headers['content-disposition']).toBe(
        `attachment; filename="bukti _.png"; filename*=UTF-8''bukti%20%C3%A9.png`,
      );
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['content-security-policy']).toBe(
        "default-src 'none'; sandbox",
      );
      expect(response.headers['cache-control']).toBe('private, no-store');
    });

    it('uses the detected type, never what the browser claimed', async () => {
      const { ticketId, attachmentId } = await ticketWithAttachment(
        PDF,
        'laporan.pdf',
        'text/html',
      );

      const response = await download('Staf IT IT01', ticketId, attachmentId);

      expect(response.headers['content-type']).toBe('application/pdf');
    });

    it.each([
      ['a colleague in the origin divisi', 'Staf IT IT02'],
      ['the origin manager', 'Manager IT IT03'],
      ['the superadmin', 'Super Admin SA01'],
    ])('lets %s download', async (_label, name) => {
      const { ticketId, attachmentId } = await ticketWithAttachment();

      const response = await download(name, ticketId, attachmentId);

      expect(response.status).toBe(200);
    });

    it.each([
      ['an unrelated divisi', 'Manager Legal LG01'],
      ['the destination manager before approval', 'Manager Tax TX02'],
      ['destination staff before approval', 'Staf Tax TX01'],
    ])('answers 404 for %s', async (_label, name) => {
      const { ticketId, attachmentId } = await ticketWithAttachment();

      const response = await download(name, ticketId, attachmentId);

      expect(response.status).toBe(404);
      expect(JSON.parse(response.body.toString()).message).toBe(
        ATTACHMENT_NOT_FOUND_MESSAGE,
      );
    });

    it('follows the ticket stage for the destination divisi', async () => {
      const { ticketId, attachmentId } = await ticketWithAttachment();
      const url = attachmentUrl(ticketId, attachmentId);
      const staff = await loginCookie('Staf Tax TX01');
      const manager = await loginCookie('Manager Tax TX02');
      const statusFor = async (cookie: string) =>
        (await request(server()).get(url).set('Cookie', cookie)).status;

      attachments.stages.set(ticketId, 'MENUNGGU_MANAGER_TUJUAN');
      expect(await statusFor(staff)).toBe(404);
      expect(await statusFor(manager)).toBe(200);

      attachments.stages.set(ticketId, 'MENUNGGU_STAF_TUJUAN');
      expect(await statusFor(staff)).toBe(200);

      attachments.stages.set(ticketId, 'DITOLAK');
      attachments.rejectedAt.set(ticketId, 'MENUNGGU_MANAGER_ASAL');
      expect(await statusFor(manager)).toBe(404);
    });

    it('does not reveal an attachment through another ticket route', async () => {
      const first = await ticketWithAttachment();
      const otherTicket = await createTicketAs('Staf IT IT01', Divisi.TAX);

      const response = await download(
        'Staf IT IT01',
        otherTicket,
        first.attachmentId,
      );

      expect(response.status).toBe(404);
    });

    it.each(['att-999', '../../etc/passwd', "x' OR '1'='1", '%00'])(
      'answers 404 for the attachment id %p',
      async (attachmentId) => {
        const { ticketId } = await ticketWithAttachment();

        const response = await download('Staf IT IT01', ticketId, attachmentId);

        expect(response.status).toBe(404);
      },
    );

    it('answers 404 and keeps serving others when the file vanished from disk', async () => {
      const { ticketId, attachmentId } = await ticketWithAttachment();
      await Promise.all(
        (await filesOnDisk()).map((name) => rm(path.join(uploadDir, name))),
      );

      const response = await download('Staf IT IT01', ticketId, attachmentId);

      expect(response.status).toBe(404);
      expect(JSON.parse(response.body.toString()).message).toBe(
        ATTACHMENT_NOT_FOUND_MESSAGE,
      );
    });

    it('is not downloadable inline by a cross-site navigation', async () => {
      const { ticketId, attachmentId } = await ticketWithAttachment();

      const response = await request(server())
        .get(attachmentUrl(ticketId, attachmentId))
        .set('Cookie', await loginCookie('Staf IT IT01'))
        .set('Sec-Fetch-Site', 'cross-site');

      expect(response.headers['content-disposition']).toMatch(/^attachment;/);
    });

    it('releases the file when the client aborts mid-download', async () => {
      const { ticketId, attachmentId } = await ticketWithAttachment(
        padded(PDF, MAX_ATTACHMENT_BYTES),
      );
      const cookie = await loginCookie('Staf IT IT01');
      const opened: Readable[] = [];
      const original = DiskAttachmentFileStore.prototype.open;
      jest
        .spyOn(DiskAttachmentFileStore.prototype, 'open')
        .mockImplementation(async function (
          this: DiskAttachmentFileStore,
          name,
        ) {
          const file = await original.call(this, name);
          if (file) opened.push(file.stream);
          return file;
        });
      await app.listen(0, '127.0.0.1');
      const { port } = app.getHttpServer().address() as AddressInfo;

      await new Promise<void>((resolve, reject) => {
        const req = http.get(
          {
            host: '127.0.0.1',
            port,
            path: attachmentUrl(ticketId, attachmentId),
            headers: { Cookie: cookie },
          },
          (res) => {
            res.once('data', () => {
              req.destroy();
              resolve();
            });
          },
        );
        req.on('error', () => undefined);
        setTimeout(() => reject(new Error('no data received')), 5000);
      });

      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(opened).toHaveLength(1);
      expect(opened[0].destroyed).toBe(true);
    });

    it('has no static route that serves the upload folder', async () => {
      await ticketWithAttachment();
      const [stored] = await filesOnDisk();
      const cookie = await loginCookie('Staf IT IT01');

      for (const url of [`/uploads/${stored}`, `/${stored}`]) {
        const response = await request(server()).get(url).set('Cookie', cookie);
        expect(response.status).toBe(404);
      }
    });
  });

  describe('POST /tickets/:ticketId/attachments', () => {
    describe('authentication and authorization', () => {
      it('rejects a request without a session and writes nothing', async () => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);

        const response = await request(server())
          .post(`/tickets/${ticketId}/attachments`)
          .attach('file', PNG, { filename: 'a.png', contentType: 'image/png' });

        expect(response.status).toBe(401);
        expect(await filesOnDisk()).toEqual([]);
      });

      it('rejects the superadmin', async () => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);

        const response = await upload(
          await loginCookie('Super Admin SA01'),
          ticketId,
          PNG,
        );

        expect(response.status).toBe(403);
        expect(response.body.message).toBe(FORBIDDEN_MESSAGE);
        expect(await filesOnDisk()).toEqual([]);
      });

      it.each([
        ['a colleague from the same divisi', 'Staf IT IT02'],
        ['a user from another divisi', 'Manager Legal LG01'],
        ['a finance user', 'Staf Finance FN01'],
      ])(
        'answers 404 for %s who did not create the ticket',
        async (_l, name) => {
          const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);

          const response = await upload(await loginCookie(name), ticketId, PNG);

          expect(response.status).toBe(404);
          expect(response.body.message).toBe(TICKET_NOT_FOUND_MESSAGE);
          expect(attachments.saved).toHaveLength(0);
          expect(await filesOnDisk()).toEqual([]);
        },
      );

      it('answers the same 404 for a ticket that does not exist', async () => {
        const response = await upload(
          await loginCookie('Staf IT IT01'),
          'IT-20260101-999',
          PNG,
        );

        expect(response.status).toBe(404);
        expect(response.body.message).toBe(TICKET_NOT_FOUND_MESSAGE);
        expect(await filesOnDisk()).toEqual([]);
      });

      it.each([
        '../../etc/passwd',
        '%2e%2e%2f%2e%2e%2fetc',
        "IT-1' OR '1'='1",
        '\u0000',
      ])('treats the odd ticket id %p as a plain miss', async (id) => {
        const response = await upload(
          await loginCookie('Staf IT IT01'),
          id,
          PNG,
        );

        expect(response.status).toBe(404);
        expect(await filesOnDisk()).toEqual([]);
      });
    });

    describe('accepted uploads', () => {
      it.each([
        ['png', PNG, 'image/png', 'bukti.png'],
        ['animated png', APNG, 'image/png', 'animasi.png'],
        ['jpeg', JPEG, 'image/jpeg', 'foto.jpeg'],
        ['webp', WEBP, 'image/webp', 'foto.webp'],
        ['pdf', PDF, 'application/pdf', 'nota.pdf'],
      ])('stores a real %s', async (_label, bytes, contentType, filename) => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);

        const response = await upload(
          await loginCookie('Staf IT IT01'),
          ticketId,
          bytes,
          { filename, contentType },
        );

        expect(response.status).toBe(201);
        expect(response.body).toEqual({
          id: expect.any(String),
          fileName: filename,
          mimeType: contentType,
          size: bytes.length,
        });
        expect(response.body).not.toHaveProperty('storedName');

        const [stored] = await filesOnDisk();
        expect(stored).toMatch(STORED_NAME);
        expect(await readFile(path.join(uploadDir, stored))).toEqual(bytes);
        expect(attachments.saved[0].uploadedById).toBe(1);
      });

      it('accepts a file of exactly 5 MB', async () => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);

        const response = await upload(
          await loginCookie('Staf IT IT01'),
          ticketId,
          padded(PNG, MAX_ATTACHMENT_BYTES),
        );

        expect(response.status).toBe(201);
      });

      it('stores the name from the server, never from the client', async () => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);

        const response = await upload(
          await loginCookie('Staf IT IT01'),
          ticketId,
          PNG,
          { filename: '../../../../tmp/evil‮gnp.png' },
        );

        expect(response.status).toBe(201);
        expect(response.body.fileName).toBe('evilgnp.png');
        const names = await filesOnDisk();
        expect(names).toHaveLength(1);
        expect(names[0]).toMatch(STORED_NAME);
        expect(await readdir(uploadRoot)).toEqual(['uploads']);
      });

      it('keeps a unicode display name intact', async () => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);

        const response = await upload(
          await loginCookie('Staf IT IT01'),
          ticketId,
          PNG,
          { filename: 'Bukti pembayaran Å 日本.png' },
        );

        expect(response.status).toBe(201);
        expect(response.body.fileName).toBe('Bukti pembayaran Å 日本.png');
      });
    });

    describe('browser content-type is not trusted or needed', () => {
      it.each(['text/html', 'application/octet-stream', 'image/x-png'])(
        'accepts a real png even when the browser labels it %s',
        async (contentType) => {
          const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);

          const response = await upload(
            await loginCookie('Staf IT IT01'),
            ticketId,
            PNG,
            { contentType },
          );

          expect(response.status).toBe(201);
          expect(response.body.mimeType).toBe('image/png');
        },
      );

      it('still checks the content when the label looks right', async () => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);

        const response = await upload(
          await loginCookie('Staf IT IT01'),
          ticketId,
          EXE,
          { filename: 'a.pdf', contentType: 'application/pdf' },
        );

        expect(response.status).toBe(400);
        expect(await filesOnDisk()).toEqual([]);
      });
    });

    describe('file type checks', () => {
      it.each([
        [
          'an executable renamed .png with a fake image mimetype',
          EXE,
          'virus.png',
          'image/png',
        ],
        ['html renamed .pdf', HTML, 'page.pdf', 'application/pdf'],
        ['png bytes named .pdf', PNG, 'a.pdf', 'application/pdf'],
        ['pdf bytes named .png', PDF, 'a.png', 'image/png'],
        ['a real png with an .exe extension', PNG, 'a.exe', 'image/png'],
        ['a real png with a double extension', PNG, 'a.png.exe', 'image/png'],
        ['a real png with no extension', PNG, 'a', 'image/png'],
        [
          'a svg',
          Buffer.from('<svg onload=alert(1)/>'),
          'a.svg',
          'image/svg+xml',
        ],
      ])(
        'rejects %s and leaves nothing on disk',
        async (_l, bytes, filename, contentType) => {
          const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);

          const response = await upload(
            await loginCookie('Staf IT IT01'),
            ticketId,
            bytes,
            { filename, contentType },
          );

          expect(response.status).toBe(400);
          expect(response.body.message).toBe(UNSUPPORTED_FILE_TYPE_MESSAGE);
          expect(attachments.saved).toHaveLength(0);
          expect(await filesOnDisk()).toEqual([]);
        },
      );

      it('rejects an empty file', async () => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);

        const response = await upload(
          await loginCookie('Staf IT IT01'),
          ticketId,
          Buffer.alloc(0),
        );

        expect(response.status).toBe(400);
        expect(await filesOnDisk()).toEqual([]);
      });
    });

    describe('size and shape limits', () => {
      it('answers 413 for a file over 5 MB and leaves nothing on disk', async () => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);

        const response = await upload(
          await loginCookie('Staf IT IT01'),
          ticketId,
          padded(PNG, MAX_ATTACHMENT_BYTES + 1),
        );

        expect(response.status).toBe(413);
        expect(attachments.saved).toHaveLength(0);
        expect(await filesOnDisk()).toEqual([]);
      });

      it('answers 400 when no file is sent', async () => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);

        const response = await request(server())
          .post(`/tickets/${ticketId}/attachments`)
          .set('Cookie', await loginCookie('Staf IT IT01'))
          .set('Content-Type', 'multipart/form-data; boundary=x')
          .send('--x--\r\n');

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(FILE_REQUIRED_MESSAGE);
      });

      it('answers 400 for a plain JSON body', async () => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);

        const response = await request(server())
          .post(`/tickets/${ticketId}/attachments`)
          .set('Cookie', await loginCookie('Staf IT IT01'))
          .send({ file: 'x' });

        expect(response.status).toBe(400);
        expect(await filesOnDisk()).toEqual([]);
      });

      it('rejects a file sent under another field name', async () => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);

        const response = await upload(
          await loginCookie('Staf IT IT01'),
          ticketId,
          PNG,
          { field: 'avatar' },
        );

        expect(response.status).toBe(400);
        expect(await filesOnDisk()).toEqual([]);
      });

      it('rejects extra text fields next to the file', async () => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);

        const response = await request(server())
          .post(`/tickets/${ticketId}/attachments`)
          .set('Cookie', await loginCookie('Staf IT IT01'))
          .field('uploadedById', '99')
          .attach('file', PNG, { filename: 'a.png', contentType: 'image/png' });

        expect(response.status).toBe(400);
        expect(attachments.saved).toHaveLength(0);
        expect(await filesOnDisk()).toEqual([]);
      });

      it('rejects two files in one request', async () => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);

        const response = await request(server())
          .post(`/tickets/${ticketId}/attachments`)
          .set('Cookie', await loginCookie('Staf IT IT01'))
          .attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })
          .attach('file', PNG, { filename: 'b.png', contentType: 'image/png' });

        expect(response.status).toBe(400);
        expect(attachments.saved).toHaveLength(0);
        expect(await filesOnDisk()).toEqual([]);
      });
    });

    describe('ticket rules', () => {
      it('allows 5 attachments and rejects the 6th, deleting its file', async () => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);
        const cookie = await loginCookie('Staf IT IT01');

        for (let i = 0; i < 5; i += 1) {
          expect((await upload(cookie, ticketId, PNG)).status).toBe(201);
        }
        const sixth = await upload(cookie, ticketId, PNG);

        expect(sixth.status).toBe(409);
        expect(sixth.body.message).toBe(ATTACHMENT_LIMIT_MESSAGE);
        expect(attachments.saved).toHaveLength(5);
        expect(await filesOnDisk()).toHaveLength(5);
      });

      it('lets only 5 of 8 simultaneous uploads through', async () => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);
        const cookie = await loginCookie('Staf IT IT01');

        const responses = await Promise.all(
          Array.from({ length: 8 }, () => upload(cookie, ticketId, PNG)),
        );

        const statuses = responses.map((r) => r.status).sort();
        expect(statuses).toEqual([201, 201, 201, 201, 201, 409, 409, 409]);
        expect(attachments.saved).toHaveLength(5);
        expect(await filesOnDisk()).toHaveLength(5);
      });

      it.each([
        'MENUNGGU_MANAGER_TUJUAN',
        'MENUNGGU_STAF_TUJUAN',
        'DIPROSES',
        'SELESAI',
        'DITOLAK',
      ] as const)('rejects uploads once the stage is %s', async (stage) => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);
        attachments.stages.set(ticketId, stage);

        const response = await upload(
          await loginCookie('Staf IT IT01'),
          ticketId,
          PNG,
        );

        expect(response.status).toBe(409);
        expect(response.body.message).toBe(STAGE_LOCKED_MESSAGE);
        expect(await filesOnDisk()).toEqual([]);
      });
    });

    describe('checks before the body is written', () => {
      const removeSpy = () =>
        jest.spyOn(DiskAttachmentFileStore.prototype, 'remove');

      afterEach(() => jest.restoreAllMocks());

      it.each([
        ['another user', 'Staf IT IT02'],
        ['a user from another divisi', 'Manager Legal LG01'],
      ])('never writes a file for %s', async (_l, name) => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);
        const remove = removeSpy();

        const response = await upload(await loginCookie(name), ticketId, PNG);

        expect(response.status).toBe(404);

        expect(remove).not.toHaveBeenCalled();
      });

      it('never writes a file for a ticket that does not exist', async () => {
        const remove = removeSpy();

        const response = await upload(
          await loginCookie('Staf IT IT01'),
          'IT-20260101-999',
          PNG,
        );

        expect(response.status).toBe(404);
        expect(remove).not.toHaveBeenCalled();
      });

      it('never writes a file once the stage is locked', async () => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);
        attachments.stages.set(ticketId, 'DIPROSES');
        const remove = removeSpy();

        const response = await upload(
          await loginCookie('Staf IT IT01'),
          ticketId,
          PNG,
        );

        expect(response.status).toBe(409);
        expect(remove).not.toHaveBeenCalled();
      });

      it('never writes the 6th file', async () => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);
        const cookie = await loginCookie('Staf IT IT01');
        for (let i = 0; i < 5; i += 1) await upload(cookie, ticketId, PNG);
        const remove = removeSpy();

        const sixth = await upload(cookie, ticketId, PNG);

        expect(sixth.status).toBe(409);
        expect(remove).not.toHaveBeenCalled();
        expect(await filesOnDisk()).toHaveLength(5);
      });

      it('still removes the file when the decision under the lock differs from the early check', async () => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);
        const cookie = await loginCookie('Staf IT IT01');
        for (let i = 0; i < 5; i += 1) await upload(cookie, ticketId, PNG);

        jest.spyOn(attachments, 'findUploadTarget').mockResolvedValue({
          stage: 'MENUNGGU_MANAGER_ASAL',
          attachmentCount: 0,
        });

        const sixth = await upload(cookie, ticketId, PNG);

        expect(sixth.status).toBe(409);
        expect(sixth.body.message).toBe(ATTACHMENT_LIMIT_MESSAGE);
        expect(await filesOnDisk()).toHaveLength(5);
      });

      it('answers a retryable 409 and removes the file when the lock wait runs out', async () => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);
        jest
          .spyOn(attachments, 'withLockedTicket')
          .mockRejectedValueOnce(new UploadContentionError());

        const response = await upload(
          await loginCookie('Staf IT IT01'),
          ticketId,
          PNG,
        );

        expect(response.status).toBe(409);
        expect(response.body.message).toBe(UPLOAD_BUSY_MESSAGE);
        expect(await filesOnDisk()).toEqual([]);
      });
    });

    describe('upload folder', () => {
      (process.platform === 'win32' ? it.skip : it)(
        'is created at startup, readable only by the app',
        async () => {
          expect((await stat(uploadDir)).mode & 0o777).toBe(0o700);
        },
      );
    });

    describe('CSRF and request hardening', () => {
      it.each(['cross-site', 'same-site'])(
        'rejects a browser request with Sec-Fetch-Site %s before touching the disk',
        async (site) => {
          const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);

          const response = await request(server())
            .post(`/tickets/${ticketId}/attachments`)
            .set('Cookie', await loginCookie('Staf IT IT01'))
            .set('Sec-Fetch-Site', site)
            .attach('file', PNG, {
              filename: 'a.png',
              contentType: 'image/png',
            });

          expect(response.status).toBe(403);
          expect(attachments.saved).toHaveLength(0);
          expect(await filesOnDisk()).toEqual([]);
        },
      );

      it('accepts a same-origin browser request', async () => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);

        const response = await request(server())
          .post(`/tickets/${ticketId}/attachments`)
          .set('Cookie', await loginCookie('Staf IT IT01'))
          .set('Sec-Fetch-Site', 'same-origin')
          .attach('file', PNG, { filename: 'a.png', contentType: 'image/png' });

        expect(response.status).toBe(201);
      });

      it('applies a stricter rate limit than the global one', async () => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);
        const cookie = await loginCookie('Staf IT IT01');

        const statuses: number[] = [];
        for (let i = 0; i < 12; i += 1) {
          statuses.push((await upload(cookie, ticketId, PNG)).status);
        }

        expect(statuses.filter((s) => s === 429)).toHaveLength(2);
        expect(await filesOnDisk()).toHaveLength(5);
      });

      it('has no endpoint that deletes an attachment', async () => {
        const ticketId = await createTicketAs('Staf IT IT01', Divisi.TAX);
        const cookie = await loginCookie('Staf IT IT01');
        const uploaded = await upload(cookie, ticketId, PNG);

        for (const method of ['delete', 'put', 'patch'] as const) {
          const response = await request(server())
            [method](`/tickets/${ticketId}/attachments/${uploaded.body.id}`)
            .set('Cookie', cookie);
          expect(response.status).toBe(404);
        }
        expect(await filesOnDisk()).toHaveLength(1);
      });
    });
  });
});

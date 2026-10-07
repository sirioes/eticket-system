import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { configureApp } from '../app.setup';
import { UserRepository } from '../auth/application/ports/user.repository';
import { FORBIDDEN_MESSAGE } from '../auth/auth.constants';
import { UserCredentials } from '../auth/domain/auth-user';
import { Divisi } from '../common/enums/divisi.enum';
import { Role } from '../common/enums/role.enum';
import {
  DuplicateTicketIdError,
  NewTicket,
  TicketRepository,
} from './application/ports/ticket.repository';
import {
  DESCRIPTION_INVALID_CHARACTER_MESSAGE,
  DESCRIPTION_LENGTH_MESSAGE,
  SAME_DIVISI_MESSAGE,
} from './application/use-cases/create-ticket.use-case';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class {
    $queryRaw = jest.fn().mockResolvedValue([1]);
  },
}));

process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.COOKIE_SECURE = 'false';
process.env.CORS_ORIGIN = 'https://eticket.example';

const PASSWORD = 'rahasia-integrasi-123';

const DESCRIPTION = 'Printer lantai 2 tidak bisa mencetak';

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

const messagesOf = (body: { message: string | string[] }) =>
  [body.message].flat();

describe('Tickets (integration)', () => {
  let passwordHash: string;
  let app: INestApplication;
  let tickets: InMemoryTicketRepository;

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

  const sessionCookieFor = async (fullName: string) => {
    const response = await request(server())
      .post('/auth/login')
      .send({ fullName, password: PASSWORD })
      .expect(200);
    const header = response.headers['set-cookie'];
    const cookies = Array.isArray(header) ? header : [header];
    return cookies[0].split(';')[0];
  };

  const createAs = async (fullName: string, body: object) =>
    request(server())
      .post('/tickets')
      .set('Cookie', await sessionCookieFor(fullName))
      .send(body);

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(PASSWORD, 10);
  });

  beforeEach(async () => {
    tickets = new InMemoryTicketRepository();

    const users = new InMemoryUserRepository([
      account(1, 'Staf IT IT01', Role.TEAM_MAIN_OFFICE, Divisi.IT),
      account(2, 'Manager Legal LG01', Role.MANAGER_MAIN_OFFICE, Divisi.LEGAL),
      account(3, 'Staf Finance FN01', Role.FINANCE_MAIN_OFFICE, Divisi.FINANCE),
      account(
        4,
        'Manager Finance FN02',
        Role.FINANCE_MANAGER_MAIN_OFFICE,
        Divisi.FINANCE,
      ),
      account(5, 'Super Admin SA01', Role.SUPERADMIN, null),
    ]);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(UserRepository)
      .useValue(users)
      .overrideProvider(TicketRepository)
      .useValue(tickets)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /tickets', () => {
    describe('authentication and authorization', () => {
      it('rejects a request without a session', async () => {
        await request(server())
          .post('/tickets')
          .send({ toDivisi: Divisi.FINANCE, description: DESCRIPTION })
          .expect(401);

        expect(tickets.stored).toHaveLength(0);
      });

      it('rejects the superadmin, who has no divisi to send from', async () => {
        const response = await createAs('Super Admin SA01', {
          toDivisi: Divisi.FINANCE,
          description: DESCRIPTION,
        });

        expect(response.status).toBe(403);
        expect(response.body.message).toBe(FORBIDDEN_MESSAGE);
        expect(tickets.stored).toHaveLength(0);
      });
    });

    describe('creating a ticket', () => {
      it.each([
        ['staff', 'Staf IT IT01', 1, Divisi.IT, 'IT'],
        ['manager', 'Manager Legal LG01', 2, Divisi.LEGAL, 'LGL'],
        ['finance staff', 'Staf Finance FN01', 3, Divisi.FINANCE, 'FIN'],
        ['finance manager', 'Manager Finance FN02', 4, Divisi.FINANCE, 'FIN'],
      ])(
        'lets a %s create a ticket from their own divisi',
        async (_label, fullName, userId, divisi, code) => {
          const toDivisi = divisi === Divisi.TAX ? Divisi.SO : Divisi.TAX;

          const response = await createAs(fullName, {
            toDivisi,
            description: DESCRIPTION,
          });

          expect(response.status).toBe(201);
          expect(response.body).toEqual({
            id: expect.stringMatching(new RegExp(`^${code}-\\d{8}-001$`)),
          });
          expect(tickets.stored).toEqual([
            {
              id: response.body.id,
              description: DESCRIPTION,
              fromDivisi: divisi,
              toDivisi,
              createdById: userId,
            },
          ]);
        },
      );

      it('numbers consecutive tickets of the same divisi in order', async () => {
        const first = await createAs('Staf IT IT01', {
          toDivisi: Divisi.TAX,
          description: DESCRIPTION,
        });
        const second = await createAs('Staf IT IT01', {
          toDivisi: Divisi.LEGAL,
          description: DESCRIPTION,
        });

        expect(first.body.id).toMatch(/-001$/);
        expect(second.body.id).toMatch(/-002$/);
      });

      it('stores multi-line text with normalized line endings', async () => {
        const response = await createAs('Staf IT IT01', {
          toDivisi: Divisi.TAX,
          description: 'Printer rusak\r\nTolong dicek hari ini',
        });

        expect(response.status).toBe(201);
        expect(tickets.stored[0].description).toBe(
          'Printer rusak\nTolong dicek hari ini',
        );
      });
    });

    describe('input validation', () => {
      it('rejects a destination equal to the sender divisi', async () => {
        const response = await createAs('Staf IT IT01', {
          toDivisi: Divisi.IT,
          description: DESCRIPTION,
        });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(SAME_DIVISI_MESSAGE);
        expect(tickets.stored).toHaveLength(0);
      });

      it.each([
        ['fromDivisi', { fromDivisi: Divisi.FINANCE }],
        ['createdById', { createdById: 5 }],
        ['id', { id: 'IT-20200101-001' }],
        ['stage', { stage: 'SELESAI' }],
        ['rejectedById', { rejectedById: 1 }],
        ['isActive', { isActive: true }],
      ])('rejects the unexpected field %s', async (_label, extra) => {
        const response = await createAs('Staf IT IT01', {
          toDivisi: Divisi.TAX,
          description: DESCRIPTION,
          ...extra,
        });

        expect(response.status).toBe(400);
        expect(tickets.stored).toHaveLength(0);
      });

      it.each([
        ['an empty body', {}],
        ['a missing toDivisi', { description: DESCRIPTION }],
        ['a missing description', { toDivisi: Divisi.TAX }],
        ['a lowercase divisi', { toDivisi: 'tax', description: DESCRIPTION }],
        ['an unknown divisi', { toDivisi: 'HR', description: DESCRIPTION }],
        ['a numeric description', { toDivisi: Divisi.TAX, description: 12345 }],
        [
          'an array description',
          { toDivisi: Divisi.TAX, description: [DESCRIPTION] },
        ],
        [
          'an object description',
          { toDivisi: Divisi.TAX, description: { $ne: null } },
        ],
        ['a null divisi', { toDivisi: null, description: DESCRIPTION }],
      ])('rejects %s', async (_label, body) => {
        const response = await createAs('Staf IT IT01', body);

        expect(response.status).toBe(400);
        expect(tickets.stored).toHaveLength(0);
      });

      it.each([
        ['too short', 'abc', DESCRIPTION_LENGTH_MESSAGE],
        ['just over the limit', 'a'.repeat(2001), DESCRIPTION_LENGTH_MESSAGE],
        ['far over the limit', 'a'.repeat(9000), DESCRIPTION_LENGTH_MESSAGE],
        ['blank', ' '.repeat(40), DESCRIPTION_LENGTH_MESSAGE],
        [
          'made of zero width spaces',
          '​'.repeat(40),
          DESCRIPTION_INVALID_CHARACTER_MESSAGE,
        ],
        [
          'carrying a null byte',
          'Printer\u0000 rusak lantai 2 gedung A',
          DESCRIPTION_INVALID_CHARACTER_MESSAGE,
        ],
      ])(
        'rejects a description that is %s',
        async (_label, description, message) => {
          const response = await createAs('Staf IT IT01', {
            toDivisi: Divisi.TAX,
            description,
          });

          expect(response.status).toBe(400);
          expect(messagesOf(response.body)).toContain(message);
          expect(tickets.stored).toHaveLength(0);
        },
      );

      it('accepts exactly 2000 characters, counting an emoji as one', async () => {
        const response = await createAs('Staf IT IT01', {
          toDivisi: Divisi.TAX,
          description: '🙏'.repeat(2000),
        });

        expect(response.status).toBe(201);
      });
    });

    describe('cross-site requests', () => {
      it('does not accept a forged request that carries no session cookie', async () => {
        await request(server())
          .post('/tickets')
          .set('Origin', 'https://evil.example')
          .type('form')
          .send({ toDivisi: Divisi.FINANCE, description: DESCRIPTION })
          .expect(401);

        expect(tickets.stored).toHaveLength(0);
      });

      it('never allows a foreign origin to read responses', async () => {
        const response = await request(server())
          .options('/tickets')
          .set('Origin', 'https://evil.example')
          .set('Access-Control-Request-Method', 'POST');

        expect(response.headers['access-control-allow-origin']).toBe(
          'https://eticket.example',
        );
        expect(response.headers['access-control-allow-origin']).not.toBe(
          'https://evil.example',
        );
      });
    });

    describe('request hardening', () => {
      it('answers 413 (not 500) for an oversized body', async () => {
        let status = 0;
        try {
          const response = await request(server())
            .post('/tickets')
            .set('Cookie', await sessionCookieFor('Staf IT IT01'))
            .send({ toDivisi: Divisi.TAX, description: 'x'.repeat(150_000) });
          status = response.status;
        } catch {
          status = 413;
        }
        expect(status).toBe(413);
      });

      it('answers 400 for malformed JSON', async () => {
        const response = await request(server())
          .post('/tickets')
          .set('Cookie', await sessionCookieFor('Staf IT IT01'))
          .set('Content-Type', 'application/json')
          .send('{"toDivisi":');
        expect(response.status).toBe(400);
      });

      it.each(['cross-site', 'same-site'])(
        'rejects a browser request with Sec-Fetch-Site %s even with a valid cookie',
        async (site) => {
          const response = await request(server())
            .post('/tickets')
            .set('Cookie', await sessionCookieFor('Staf IT IT01'))
            .set('Sec-Fetch-Site', site)
            .send({ toDivisi: Divisi.TAX, description: DESCRIPTION });
          expect(response.status).toBe(403);
          expect(tickets.stored).toHaveLength(0);
        },
      );

      it('accepts a same-origin browser request', async () => {
        const response = await request(server())
          .post('/tickets')
          .set('Cookie', await sessionCookieFor('Staf IT IT01'))
          .set('Sec-Fetch-Site', 'same-origin')
          .send({ toDivisi: Divisi.TAX, description: DESCRIPTION });
        expect(response.status).toBe(201);
      });
    });

    describe('failures', () => {
      it('hides internal error details from the client', async () => {
        jest
          .spyOn(tickets, 'insert')
          .mockRejectedValueOnce(
            new Error('connect ECONNREFUSED internal-db-host:3306'),
          );

        const response = await createAs('Staf IT IT01', {
          toDivisi: Divisi.TAX,
          description: DESCRIPTION,
        });

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          statusCode: 500,
          message: 'Internal server error',
        });
        expect(response.text).not.toMatch(/internal-db-host|ECONNREFUSED/);
      });
    });
  });
});

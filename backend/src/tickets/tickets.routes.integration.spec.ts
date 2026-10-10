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
import { CROSS_SITE_MESSAGE } from '../common/guards/fetch-metadata.guard';
import { Divisi } from '../common/enums/divisi.enum';
import { Role } from '../common/enums/role.enum';
import {
  TicketDetail,
  TicketPage,
  TicketQueryRepository,
} from './application/ports/ticket-query.repository';
import { TicketStageRepository } from './application/ports/ticket-stage.repository';
import {
  ACTION_NOT_AVAILABLE_MESSAGE,
  NOT_AUTHORIZED_ACTOR_MESSAGE,
  STAGE_CHANGED_MESSAGE,
} from './application/use-cases/advance-ticket-stage.use-case';
import { TICKET_NOT_FOUND_MESSAGE } from './attachments/application/use-cases/upload-attachment.use-case';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class {
    $queryRaw = jest.fn().mockResolvedValue([1]);
  },
}));

process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.COOKIE_SECURE = 'false';
process.env.CORS_ORIGIN = 'https://eticket.example';

const PASSWORD = 'rahasia-integrasi-123';

const NO_STORE = 'private, no-store';

const EMPTY_PAGE: TicketPage = { items: [], total: 0 };

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

class FakeTicketQueryRepository extends TicketQueryRepository {
  detail: TicketDetail | null = null;
  readonly listOutgoingCalls: unknown[][] = [];
  readonly listIncomingCalls: unknown[][] = [];

  async findDetailById() {
    return this.detail;
  }

  async findVisibilityById() {
    return this.detail;
  }

  async listOutgoing(...args: unknown[]) {
    this.listOutgoingCalls.push(args);
    return EMPTY_PAGE;
  }

  async listIncoming(...args: unknown[]) {
    this.listIncomingCalls.push(args);
    return EMPTY_PAGE;
  }

  async countOutgoingInStages() {
    return 2;
  }

  async countIncomingInStages() {
    return 3;
  }

  async findOutgoingForExport() {
    return [];
  }
}

class FakeTicketStageRepository extends TicketStageRepository {
  result = true;
  readonly commands: unknown[] = [];

  async advanceStage(command: unknown) {
    this.commands.push(command);
    return this.result;
  }
}

const ticketAt = (
  stage: TicketDetail['stage'],
  overrides: Partial<TicketDetail> = {},
): TicketDetail => ({
  id: 'IT-2026-0001',
  description: 'Printer lantai 2 tidak bisa mencetak',
  stage,
  rejectedAtStage: null,
  fromDivisi: Divisi.IT,
  toDivisi: Divisi.FINANCE,
  createdAt: new Date('2026-10-01T02:00:00Z'),
  createdById: 1,
  createdBy: { fullName: 'Staf IT IT01', divisi: Divisi.IT },
  attachments: [],
  timeline: [],
  ...overrides,
});

describe('Tickets read and stage routes (integration)', () => {
  let passwordHash: string;
  let app: INestApplication;
  let queries: FakeTicketQueryRepository;
  let stages: FakeTicketStageRepository;

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

  const STAFF_IT = 'Staf IT IT01';
  const MANAGER_IT = 'Manager IT IT02';
  const STAFF_FINANCE = 'Staf Finance FN01';
  const SUPERADMIN = 'Super Admin SA01';

  const sessionCookieFor = async (fullName: string) => {
    const response = await request(server())
      .post('/auth/login')
      .send({ fullName, password: PASSWORD })
      .expect(200);
    const header = response.headers['set-cookie'];
    const cookies = Array.isArray(header) ? header : [header];
    return cookies[0].split(';')[0];
  };

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(PASSWORD, 10);
  });

  beforeEach(async () => {
    queries = new FakeTicketQueryRepository();
    stages = new FakeTicketStageRepository();

    const users = new InMemoryUserRepository([
      account(1, STAFF_IT, Role.TEAM_MAIN_OFFICE, Divisi.IT),
      account(2, MANAGER_IT, Role.MANAGER_MAIN_OFFICE, Divisi.IT),
      account(3, STAFF_FINANCE, Role.FINANCE_MAIN_OFFICE, Divisi.FINANCE),
      account(5, SUPERADMIN, Role.SUPERADMIN, null),
    ]);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(UserRepository)
      .useValue(users)
      .overrideProvider(TicketQueryRepository)
      .useValue(queries)
      .overrideProvider(TicketStageRepository)
      .useValue(stages)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('authentication', () => {
    it.each([
      ['GET', '/tickets/outgoing'],
      ['GET', '/tickets/incoming'],
      ['GET', '/tickets/action-counts'],
      ['GET', '/tickets/IT-2026-0001'],
      ['PATCH', '/tickets/IT-2026-0001/stage'],
    ])('rejects %s %s without a session', async (method, path) => {
      const response = await request(server())
        [method.toLowerCase() as 'get' | 'patch'](path)
        .send(method === 'PATCH' ? { action: 'TERIMA' } : undefined);

      expect(response.status).toBe(401);
      expect(stages.commands).toHaveLength(0);
    });
  });

  describe('GET /tickets/outgoing and /incoming', () => {
    it('scopes the outgoing list to the divisi of the session', async () => {
      const response = await request(server())
        .get('/tickets/outgoing?page=2&limit=5&search=IT-2026&status=DIPROSES')
        .set('Cookie', await sessionCookieFor(STAFF_IT))
        .expect(200);

      expect(response.body).toEqual({
        items: [],
        total: 0,
        page: 2,
        limit: 5,
        totalPages: 0,
      });
      expect(queries.listOutgoingCalls).toHaveLength(1);
      const [scope, filter, pagination] = queries.listOutgoingCalls[0];
      expect(scope).toEqual({ fromDivisi: Divisi.IT });
      expect(filter).toMatchObject({ search: 'IT-2026', stage: 'DIPROSES' });
      expect(pagination).toEqual({ page: 2, limit: 5 });
    });

    it('scopes the incoming list to the role and divisi of the session', async () => {
      await request(server())
        .get('/tickets/incoming')
        .set('Cookie', await sessionCookieFor(STAFF_FINANCE))
        .expect(200);

      const [scope] = queries.listIncomingCalls[0];
      expect(scope).toEqual({
        viewer: { role: Role.FINANCE_MAIN_OFFICE, divisi: Divisi.FINANCE },
      });
    });

    it('does not let the client choose the scope', async () => {
      const response = await request(server())
        .get('/tickets/outgoing?fromDivisi=FINANCE')
        .set('Cookie', await sessionCookieFor(STAFF_IT));

      expect(response.status).toBe(400);
      expect(queries.listOutgoingCalls).toHaveLength(0);
    });

    it.each([
      'page=0',
      'page=1001',
      'page=abc',
      'limit=0',
      'limit=101',
      'search=a%25b',
      'status=BUKAN_STATUS',
      'divisi=BUKAN_DIVISI',
      'dateFrom=2026-02-30',
      'dateFrom=01-02-2026',
    ])('rejects the query %s with 400', async (queryString) => {
      const response = await request(server())
        .get(`/tickets/incoming?${queryString}`)
        .set('Cookie', await sessionCookieFor(STAFF_IT));

      expect(response.status).toBe(400);
      expect(queries.listIncomingCalls).toHaveLength(0);
    });

    it('rejects a reversed date range with 400', async () => {
      const response = await request(server())
        .get('/tickets/outgoing?dateFrom=2026-10-05&dateTo=2026-10-01')
        .set('Cookie', await sessionCookieFor(STAFF_IT));

      expect(response.status).toBe(400);
      expect(queries.listOutgoingCalls).toHaveLength(0);
    });

    it('refuses the superadmin, who has no divisi', async () => {
      const response = await request(server())
        .get('/tickets/outgoing')
        .set('Cookie', await sessionCookieFor(SUPERADMIN));

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(FORBIDDEN_MESSAGE);
    });
  });

  describe('GET /tickets/action-counts', () => {
    it('is not captured by the :id route', async () => {
      const response = await request(server())
        .get('/tickets/action-counts')
        .set('Cookie', await sessionCookieFor(MANAGER_IT))
        .expect(200);

      expect(response.body).toEqual({ outgoing: 2, incoming: 3 });
    });

    it('answers 0/0 without querying for a role that can act on nothing', async () => {
      const response = await request(server())
        .get('/tickets/action-counts')
        .set('Cookie', await sessionCookieFor(STAFF_IT))
        .expect(200);

      expect(response.body).toEqual({ outgoing: 0, incoming: 3 });
    });

    it('refuses the superadmin', async () => {
      await request(server())
        .get('/tickets/action-counts')
        .set('Cookie', await sessionCookieFor(SUPERADMIN))
        .expect(403);
    });
  });

  describe('GET /tickets/:id', () => {
    it('returns the detail with the actions the viewer may take', async () => {
      queries.detail = ticketAt('MENUNGGU_MANAGER_ASAL');

      const response = await request(server())
        .get('/tickets/IT-2026-0001')
        .set('Cookie', await sessionCookieFor(MANAGER_IT))
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'IT-2026-0001',
        stage: 'MENUNGGU_MANAGER_ASAL',
        availableActions: ['TERIMA', 'TOLAK'],
        isCreator: false,
      });
      expect(response.body).not.toHaveProperty('createdById');
    });

    it('lets the superadmin read, without any action', async () => {
      queries.detail = ticketAt('MENUNGGU_MANAGER_ASAL');

      const response = await request(server())
        .get('/tickets/IT-2026-0001')
        .set('Cookie', await sessionCookieFor(SUPERADMIN))
        .expect(200);

      expect(response.body.availableActions).toEqual([]);
    });

    it('answers 404 (not 403) for a ticket the viewer may not see', async () => {
      queries.detail = ticketAt('MENUNGGU_MANAGER_ASAL');

      const response = await request(server())
        .get('/tickets/IT-2026-0001')
        .set('Cookie', await sessionCookieFor(STAFF_FINANCE));

      expect(response.status).toBe(404);
      expect(response.body.message).toBe(TICKET_NOT_FOUND_MESSAGE);
    });

    it('answers 404 for a ticket that does not exist', async () => {
      await request(server())
        .get('/tickets/IT-2026-9999')
        .set('Cookie', await sessionCookieFor(STAFF_IT))
        .expect(404);
    });

    it.each(['IT_2026', 'IT.2026', 'IT%25', `A${'B'.repeat(100)}`])(
      'rejects the malformed id %p with 400',
      async (id) => {
        queries.detail = ticketAt('SELESAI');

        const response = await request(server())
          .get(`/tickets/${id}`)
          .set('Cookie', await sessionCookieFor(STAFF_IT));

        expect(response.status).toBe(400);
      },
    );
  });

  describe('PATCH /tickets/:id/stage', () => {
    const patchAs = async (
      fullName: string,
      body: object | undefined,
      headers: Record<string, string> = {},
      id = 'IT-2026-0001',
    ) => {
      const cookie = await sessionCookieFor(fullName);
      let call = request(server())
        .patch(`/tickets/${id}/stage`)
        .set('Cookie', cookie);
      for (const [name, value] of Object.entries(headers)) {
        call = call.set(name, value);
      }
      return call.send(body);
    };

    it('advances the stage using only the action from the client', async () => {
      queries.detail = ticketAt('MENUNGGU_MANAGER_ASAL');

      const response = await patchAs(MANAGER_IT, { action: 'TERIMA' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 'IT-2026-0001',
        stage: 'MENUNGGU_MANAGER_TUJUAN',
      });
      expect(stages.commands).toEqual([
        {
          ticketId: 'IT-2026-0001',
          expectedStage: 'MENUNGGU_MANAGER_ASAL',
          action: 'TERIMA',
          nextStage: 'MENUNGGU_MANAGER_TUJUAN',
          actorId: 2,
        },
      ]);
    });

    it.each([
      [{ action: 'TERIMA', nextStage: 'SELESAI' }],
      [{ action: 'TERIMA', actorId: 99 }],
      [{ action: 'TERIMA', stage: 'SELESAI' }],
      [{ action: 'LOMPAT' }],
      [{ action: 'terima' }],
      [{ action: ['TERIMA'] }],
      [{}],
    ])('rejects the body %j with 400', async (body) => {
      queries.detail = ticketAt('MENUNGGU_MANAGER_ASAL');

      const response = await patchAs(MANAGER_IT, body);

      expect(response.status).toBe(400);
      expect(stages.commands).toHaveLength(0);
    });

    it('rejects a request without a body with 400', async () => {
      queries.detail = ticketAt('MENUNGGU_MANAGER_ASAL');

      const response = await patchAs(MANAGER_IT, undefined);

      expect(response.status).toBe(400);
      expect(stages.commands).toHaveLength(0);
    });

    it('refuses a cross-site request before touching anything', async () => {
      queries.detail = ticketAt('MENUNGGU_MANAGER_ASAL');

      const response = await patchAs(
        MANAGER_IT,
        { action: 'TERIMA' },
        { 'Sec-Fetch-Site': 'cross-site' },
      );

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(CROSS_SITE_MESSAGE);
      expect(stages.commands).toHaveLength(0);
    });

    it('refuses a same-site (sibling subdomain) request', async () => {
      queries.detail = ticketAt('MENUNGGU_MANAGER_ASAL');

      const response = await patchAs(
        MANAGER_IT,
        { action: 'TERIMA' },
        { 'Sec-Fetch-Site': 'same-site' },
      );

      expect(response.status).toBe(403);
      expect(stages.commands).toHaveLength(0);
    });

    it('accepts a same-origin browser request', async () => {
      queries.detail = ticketAt('MENUNGGU_MANAGER_ASAL');

      await patchAs(
        MANAGER_IT,
        { action: 'TERIMA' },
        { 'Sec-Fetch-Site': 'same-origin' },
      ).then((response) => expect(response.status).toBe(200));
    });

    it('answers 403 when the viewer is not the actor of this stage', async () => {
      queries.detail = ticketAt('MENUNGGU_MANAGER_ASAL');

      const response = await patchAs(STAFF_IT, { action: 'TERIMA' });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(NOT_AUTHORIZED_ACTOR_MESSAGE);
      expect(stages.commands).toHaveLength(0);
    });

    it('answers 404 when the ticket is invisible to the caller', async () => {
      queries.detail = ticketAt('MENUNGGU_MANAGER_ASAL');

      const response = await patchAs(STAFF_FINANCE, { action: 'TERIMA' });

      expect(response.status).toBe(404);
      expect(stages.commands).toHaveLength(0);
    });

    it('refuses the superadmin', async () => {
      queries.detail = ticketAt('MENUNGGU_MANAGER_ASAL');

      const response = await patchAs(SUPERADMIN, { action: 'TERIMA' });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(FORBIDDEN_MESSAGE);
      expect(stages.commands).toHaveLength(0);
    });

    it('answers 409 for an action the stage does not offer', async () => {
      queries.detail = ticketAt('MENUNGGU_MANAGER_ASAL');

      const response = await patchAs(MANAGER_IT, { action: 'SELESAI' });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe(ACTION_NOT_AVAILABLE_MESSAGE);
    });

    it('answers 409 when somebody else moved the ticket first', async () => {
      queries.detail = ticketAt('MENUNGGU_MANAGER_ASAL');
      stages.result = false;

      const response = await patchAs(MANAGER_IT, { action: 'TERIMA' });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe(STAGE_CHANGED_MESSAGE);
    });

    it('never changes state through GET', async () => {
      queries.detail = ticketAt('MENUNGGU_MANAGER_ASAL');

      const response = await request(server())
        .get('/tickets/IT-2026-0001/stage?action=TERIMA')
        .set('Cookie', await sessionCookieFor(MANAGER_IT));

      expect(response.status).toBe(404);
      expect(stages.commands).toHaveLength(0);
    });
  });

  describe('Cache-Control', () => {
    it.each([
      ['a list', '/tickets/outgoing', 200],
      ['the action counts', '/tickets/action-counts', 200],
      ['a missing ticket', '/tickets/IT-2026-9999', 404],
      ['a malformed id', '/tickets/IT_2026', 400],
    ])('is private, no-store for %s', async (_label, path, status) => {
      const response = await request(server())
        .get(path)
        .set('Cookie', await sessionCookieFor(STAFF_IT));

      expect(response.status).toBe(status);
      expect(response.headers['cache-control']).toBe(NO_STORE);
    });

    it('is private, no-store for a ticket detail', async () => {
      queries.detail = ticketAt('SELESAI');

      const response = await request(server())
        .get('/tickets/IT-2026-0001')
        .set('Cookie', await sessionCookieFor(STAFF_IT))
        .expect(200);

      expect(response.headers['cache-control']).toBe(NO_STORE);
    });

    it('is private, no-store for a conflict on the stage change', async () => {
      queries.detail = ticketAt('MENUNGGU_MANAGER_ASAL');

      const response = await request(server())
        .patch('/tickets/IT-2026-0001/stage')
        .set('Cookie', await sessionCookieFor(MANAGER_IT))
        .send({ action: 'SELESAI' });

      expect(response.status).toBe(409);
      expect(response.headers['cache-control']).toBe(NO_STORE);
    });
  });

  describe('throttling per account', () => {
    it('does not let one busy account block a colleague behind the same IP', async () => {
      const busy = await sessionCookieFor(STAFF_IT);
      const colleague = await sessionCookieFor(STAFF_FINANCE);

      const statuses: number[] = [];
      for (let i = 0; i < 101; i += 1) {
        const response = await request(server())
          .get('/tickets/action-counts')
          .set('Cookie', busy);
        statuses.push(response.status);
      }

      expect(statuses.slice(0, 100).every((status) => status === 200)).toBe(
        true,
      );
      expect(statuses[100]).toBe(429);

      await request(server())
        .get('/tickets/action-counts')
        .set('Cookie', colleague)
        .expect(200);
    });

    it('limits stage changes per account more strictly than reads', async () => {
      queries.detail = ticketAt('MENUNGGU_MANAGER_ASAL');
      stages.result = false;
      const cookie = await sessionCookieFor(MANAGER_IT);

      const statuses: number[] = [];
      for (let i = 0; i < 31; i += 1) {
        const response = await request(server())
          .patch('/tickets/IT-2026-0001/stage')
          .set('Cookie', cookie)
          .send({ action: 'TERIMA' });
        statuses.push(response.status);
      }

      expect(statuses.slice(0, 30).every((status) => status === 409)).toBe(
        true,
      );
      expect(statuses[30]).toBe(429);
    });

    it('still counts anonymous requests per IP', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 6; i += 1) {
        const response = await request(server())
          .post('/auth/login')
          .send({ fullName: 'Tidak Ada XX99', password: 'salah-salah-123' });
        statuses.push(response.status);
      }

      expect(statuses[5]).toBe(429);
    });
  });
});

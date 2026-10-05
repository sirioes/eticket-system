import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { configureApp } from '../app.setup';
import { Divisi } from '../common/enums/divisi.enum';
import { Role } from '../common/enums/role.enum';
import { UserRepository } from './application/ports/user.repository';
import { ACCESS_TOKEN_COOKIE, FORBIDDEN_MESSAGE, INVALID_SESSION_MESSAGE } from './auth.constants';
import { INVALID_CREDENTIALS_MESSAGE } from './application/use-cases/login.use-case';
import { UserCredentials } from './domain/auth-user';
import { Roles } from './presentation/decorators/roles.decorator';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class {
    $queryRaw = jest.fn().mockResolvedValue([1]);
  },
}));

process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.COOKIE_SECURE = 'false';

const PASSWORD = 'rahasia-integrasi-123';

@Controller('probe')
class ProbeController {
  @Get('undeclared')
  undeclared() {
    return { ok: true };
  }

  @Roles(Role.SUPERADMIN)
  @Get('superadmin')
  superadmin() {
    return { ok: true };
  }
}

class InMemoryUserRepository extends UserRepository {
  constructor(private readonly users: UserCredentials[]) {
    super();
  }

  async findCredentialsByFullName(normalizedFullName: string) {
    const wanted = normalizedFullName.toLowerCase();
    return this.users.find((user) => user.fullName.toLowerCase() === wanted) ?? null;
  }

  async findAuthUserById(id: number) {
    const found = this.users.find((user) => user.id === id);
    if (!found) return null;
    const { passwordHash: _passwordHash, ...authUser } = found;
    return authUser;
  }

  deactivate(id: number) {
    const index = this.users.findIndex((user) => user.id === id);
    this.users[index] = { ...this.users[index], isActive: false };
  }
}

describe('Auth (integration)', () => {
  let passwordHash: string;
  let app: INestApplication;
  let users: InMemoryUserRepository;

  const manager = () => ({
    id: 1,
    fullName: 'Manager Legal LG01',
    role: Role.MANAGER_MAIN_OFFICE,
    divisi: Divisi.LEGAL,
    isActive: true,
    passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
    passwordHash,
  });

  const superadmin = () => ({
    id: 2,
    fullName: 'Super Admin SA01',
    role: Role.SUPERADMIN,
    divisi: null,
    isActive: true,
    passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
    passwordHash,
  });

  const inactive = () => ({
    id: 3,
    fullName: 'Staf Nonaktif IT01',
    role: Role.TEAM_MAIN_OFFICE,
    divisi: Divisi.IT,
    isActive: false,
    passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
    passwordHash,
  });

  const server = () => app.getHttpServer();

  const login = (fullName: string, password = PASSWORD) =>
    request(server()).post('/auth/login').send({ fullName, password });

  const sessionCookieFor = async (fullName: string) => {
    const response = await login(fullName).expect(200);
    return cookiesOf(response)[0].split(';')[0];
  };

  const cookiesOf = (response: request.Response): string[] => {
    const header = response.headers['set-cookie'];
    if (!header) return [];
    return Array.isArray(header) ? header : [header];
  };

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(PASSWORD, 10);
  });

  beforeEach(async () => {
    users = new InMemoryUserRepository([manager(), superadmin(), inactive()]);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    })
      .overrideProvider(UserRepository)
      .useValue(users)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('public endpoints', () => {
    it('serves /health without a session', async () => {
      await request(server()).get('/health').expect(200, { status: 'ok' });
    });

    it('lets anyone call logout, even without a session', async () => {
      await request(server()).post('/auth/logout').expect(204);
    });
  });

  describe('POST /auth/login', () => {
    it('sets an httpOnly session cookie and returns only public user fields', async () => {
      const response = await login('Manager Legal LG01').expect(200);

      expect(response.body).toEqual({
        user: { id: 1, fullName: 'Manager Legal LG01', role: Role.MANAGER_MAIN_OFFICE, divisi: Divisi.LEGAL },
      });

      const [cookie] = cookiesOf(response);
      expect(cookie).toMatch(new RegExp(`^${ACCESS_TOKEN_COOKIE}=`));
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Path=\//);
      expect(cookie).not.toMatch(/Max-Age|Expires/i);
    });

    it('issues a token that carries only sub, iat and exp', async () => {
      const response = await login('Manager Legal LG01').expect(200);
      const token = cookiesOf(response)[0].split(';')[0].split('=')[1];
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

      expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub']);
      expect(payload.sub).toBe(1);
    });

    it('normalizes spacing and ignores letter case in the name', async () => {
      await login('   manager   LEGAL lg01 ').expect(200);
    });

    it.each([
      ['a wrong password', 'Manager Legal LG01', 'salah-total'],
      ['an unknown name', 'Tidak Terdaftar XX99', PASSWORD],
      ['an inactive account', 'Staf Nonaktif IT01', PASSWORD],
    ])('rejects %s with the same generic message and no cookie', async (_label, fullName, password) => {
      const response = await login(fullName, password).expect(401);

      expect(response.body.message).toBe(INVALID_CREDENTIALS_MESSAGE);
      expect(cookiesOf(response)).toHaveLength(0);
    });

    it.each([
      ['a missing password', { fullName: 'Manager Legal LG01' }],
      ['an object instead of a name', { fullName: { contains: '' }, password: PASSWORD }],
      ['an unexpected extra field', { fullName: 'Manager Legal LG01', password: PASSWORD, role: 'SUPERADMIN' }],
      ['an oversized name', { fullName: 'x'.repeat(192), password: PASSWORD }],
    ])('rejects %s with 400', async (_label, body) => {
      await request(server()).post('/auth/login').send(body).expect(400);
    });

    it('blocks the sixth attempt within a minute with 429', async () => {
      const statuses: number[] = [];

      for (let attempt = 0; attempt < 6; attempt += 1) {
        statuses.push((await login('Manager Legal LG01', 'salah-total')).status);
      }

      expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
    });
  });

  describe('session lifecycle', () => {
    it('returns the current user from /auth/me with a valid cookie', async () => {
      const cookie = await sessionCookieFor('Manager Legal LG01');

      const response = await request(server()).get('/auth/me').set('Cookie', cookie).expect(200);

      expect(response.body.user).toEqual({
        id: 1,
        fullName: 'Manager Legal LG01',
        role: Role.MANAGER_MAIN_OFFICE,
        divisi: Divisi.LEGAL,
      });
    });

    it('rejects /auth/me without a cookie', async () => {
      const response = await request(server()).get('/auth/me').expect(401);
      expect(response.body.message).toBe(INVALID_SESSION_MESSAGE);
    });

    it('rejects a tampered token', async () => {
      const cookie = await sessionCookieFor('Manager Legal LG01');
      const tampered = `${cookie.slice(0, -2)}xx`;

      await request(server()).get('/auth/me').set('Cookie', tampered).expect(401);
    });

    it('clears the cookie with the same attributes on logout', async () => {
      const response = await request(server()).post('/auth/logout').expect(204);
      const [cookie] = cookiesOf(response);

      expect(cookie).toMatch(new RegExp(`^${ACCESS_TOKEN_COOKIE}=;`));
      expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Path=\//);
    });

    it('ends an existing session as soon as the account is deactivated', async () => {
      const cookie = await sessionCookieFor('Manager Legal LG01');
      await request(server()).get('/auth/me').set('Cookie', cookie).expect(200);

      users.deactivate(1);

      const response = await request(server()).get('/auth/me').set('Cookie', cookie).expect(401);
      expect(response.body.message).toBe(INVALID_SESSION_MESSAGE);
    });
  });

  describe('authorization', () => {
    it('answers 401 before 403 when there is no session', async () => {
      await request(server()).get('/probe/undeclared').expect(401);
    });

    it('denies an endpoint that declares no roles, even for superadmin', async () => {
      const cookie = await sessionCookieFor('Super Admin SA01');

      const response = await request(server()).get('/probe/undeclared').set('Cookie', cookie).expect(403);
      expect(response.body.message).toBe(FORBIDDEN_MESSAGE);
    });

    it('denies a role that is not listed', async () => {
      const cookie = await sessionCookieFor('Manager Legal LG01');

      await request(server()).get('/probe/superadmin').set('Cookie', cookie).expect(403);
    });

    it('allows a listed role', async () => {
      const cookie = await sessionCookieFor('Super Admin SA01');

      await request(server()).get('/probe/superadmin').set('Cookie', cookie).expect(200, { ok: true });
    });
  });
});
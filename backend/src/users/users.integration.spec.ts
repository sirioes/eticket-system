import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { configureApp } from '../app.setup';
import { UserRepository } from '../auth/application/ports/user.repository';
import {
  FORBIDDEN_MESSAGE,
  INVALID_SESSION_MESSAGE,
} from '../auth/auth.constants';
import { AuthUser, UserCredentials } from '../auth/domain/auth-user';
import { Divisi } from '../common/enums/divisi.enum';
import { Role } from '../common/enums/role.enum';
import { CROSS_SITE_MESSAGE } from '../common/guards/fetch-metadata.guard';
import { NO_STORE_CACHE_CONTROL } from '../common/interceptors/no-store.interceptor';
import {
  DuplicateFullNameError,
  NewUser,
  UserAdminRepository,
  UserChanges,
} from './application/ports/user-admin.repository';
import { FULL_NAME_TAKEN_MESSAGE } from './application/use-cases/create-user.use-case';
import { SELF_CHANGE_FORBIDDEN_MESSAGE } from './application/use-cases/update-user.use-case';
import { SELF_RESET_FORBIDDEN_MESSAGE } from './application/use-cases/reset-user-password.use-case';
import {
  ROLE_DIVISI_INVALID_MESSAGE,
  USER_NOT_FOUND_MESSAGE,
} from './users.constants';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class {
    $queryRaw = jest.fn().mockResolvedValue([1]);
  },
}));

process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.COOKIE_SECURE = 'false';

const PASSWORD = 'rahasia-integrasi-123';

const stripHash = (user: UserCredentials): AuthUser => {
  const { passwordHash: _passwordHash, ...authUser } = user;
  return authUser;
};

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
    return found ? stripHash(found) : null;
  }

  async findCredentialsById(id: number) {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async updatePassword(
    id: number,
    passwordHash: string,
    passwordChangedAt: Date,
  ) {
    const index = this.users.findIndex((user) => user.id === id);
    this.users[index] = {
      ...this.users[index],
      passwordHash,
      passwordChangedAt,
    };
  }
}

class InMemoryUserAdminRepository extends UserAdminRepository {
  constructor(private readonly users: UserCredentials[]) {
    super();
  }

  async findAll() {
    return [...this.users]
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map(stripHash);
  }

  async create(user: NewUser) {
    const wanted = user.fullName.toLowerCase();
    if (
      this.users.some((existing) => existing.fullName.toLowerCase() === wanted)
    ) {
      throw new DuplicateFullNameError(user.fullName);
    }
    const created: UserCredentials = {
      id: Math.max(...this.users.map((existing) => existing.id)) + 1,
      fullName: user.fullName,
      role: user.role,
      divisi: user.divisi,
      isActive: true,
      passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
      passwordHash: user.passwordHash,
    };
    this.users.push(created);
    return stripHash(created);
  }

  async update(id: number, changes: UserChanges) {
    const index = this.users.findIndex((user) => user.id === id);
    const current = this.users[index];
    this.users[index] = {
      ...current,
      role: changes.role ?? current.role,
      divisi: changes.divisi === undefined ? current.divisi : changes.divisi,
      isActive: changes.isActive ?? current.isActive,
    };
    return stripHash(this.users[index]);
  }
}

describe('Users (integration)', () => {
  let passwordHash: string;
  let app: INestApplication;

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

  const login = (fullName: string, password = PASSWORD) =>
    request(server()).post('/auth/login').send({ fullName, password });

  const sessionCookieFor = async (fullName: string, password = PASSWORD) => {
    const response = await login(fullName, password).expect(200);
    const header = response.headers['set-cookie'];
    const cookies = Array.isArray(header) ? header : [header];
    return cookies[0].split(';')[0];
  };

  const NEW_USER = {
    fullName: 'Rina Wulandari TX01',
    role: Role.TEAM_MAIN_OFFICE,
    divisi: Divisi.TAX,
    password: 'password-awal-1',
  };

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(PASSWORD, 10);
  });

  beforeEach(async () => {
    const store: UserCredentials[] = [
      account(1, 'Super Admin SA01', Role.SUPERADMIN, null),
      account(2, 'Manager Legal LG01', Role.MANAGER_MAIN_OFFICE, Divisi.LEGAL),
      account(3, 'Staf IT IT01', Role.TEAM_MAIN_OFFICE, Divisi.IT),
    ];

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(UserRepository)
      .useValue(new InMemoryUserRepository(store))
      .overrideProvider(UserAdminRepository)
      .useValue(new InMemoryUserAdminRepository(store))
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('access control', () => {
    const endpoints = [
      [
        'GET /users',
        (cookie?: string) =>
          withCookie(request(server()).get('/users'), cookie),
      ],
      [
        'POST /users',
        (cookie?: string) =>
          withCookie(request(server()).post('/users').send(NEW_USER), cookie),
      ],
      [
        'PATCH /users/:id',
        (cookie?: string) =>
          withCookie(
            request(server()).patch('/users/3').send({ isActive: false }),
            cookie,
          ),
      ],
      [
        'PATCH /users/:id/reset-password',
        (cookie?: string) =>
          withCookie(
            request(server())
              .patch('/users/3/reset-password')
              .send({ newPassword: 'password-baru-1' }),
            cookie,
          ),
      ],
    ] as const;

    const withCookie = (call: request.Test, cookie?: string) =>
      cookie ? call.set('Cookie', cookie) : call;

    it.each(endpoints)(
      'answers 401 on %s without a session',
      async (_label, call) => {
        await call().expect(401);
      },
    );

    it.each(endpoints)(
      'answers 403 on %s for a manager',
      async (_label, call) => {
        const cookie = await sessionCookieFor('Manager Legal LG01');

        const response = await call(cookie).expect(403);
        expect(response.body.message).toBe(FORBIDDEN_MESSAGE);
      },
    );

    it.each(endpoints)(
      'answers 403 on %s for a staff member',
      async (_label, call) => {
        const cookie = await sessionCookieFor('Staf IT IT01');

        await call(cookie).expect(403);
      },
    );

    it('leaves the accounts untouched after a forbidden attempt', async () => {
      const cookie = await sessionCookieFor('Staf IT IT01');

      await request(server())
        .post('/users')
        .set('Cookie', cookie)
        .send(NEW_USER)
        .expect(403);

      await login(NEW_USER.fullName, NEW_USER.password).expect(401);
    });

    it.each([
      ['POST /users', () => request(server()).post('/users').send(NEW_USER)],
      [
        'PATCH /users/:id',
        () => request(server()).patch('/users/3').send({ isActive: false }),
      ],
      [
        'PATCH /users/:id/reset-password',
        () =>
          request(server())
            .patch('/users/3/reset-password')
            .send({ newPassword: 'password-baru-1' }),
      ],
    ])(
      'refuses a cross-site %s even with a superadmin session',
      async (_label, call) => {
        const cookie = await sessionCookieFor('Super Admin SA01');

        const response = await call()
          .set('Cookie', cookie)
          .set('Sec-Fetch-Site', 'cross-site')
          .expect(403);
        expect(response.body.message).toBe(CROSS_SITE_MESSAGE);
      },
    );
  });

  describe('GET /users', () => {
    it('lists every account with public fields only and no caching', async () => {
      const cookie = await sessionCookieFor('Super Admin SA01');

      const response = await request(server())
        .get('/users')
        .set('Cookie', cookie)
        .expect(200);

      expect(response.headers['cache-control']).toBe(NO_STORE_CACHE_CONTROL);
      expect(
        response.body.map((user: { fullName: string }) => user.fullName),
      ).toEqual(['Manager Legal LG01', 'Staf IT IT01', 'Super Admin SA01']);
      for (const user of response.body) {
        expect(Object.keys(user).sort()).toEqual([
          'divisi',
          'fullName',
          'id',
          'isActive',
          'role',
        ]);
      }
    });
  });

  describe('POST /users', () => {
    const create = (body: object, cookie: string) =>
      request(server()).post('/users').set('Cookie', cookie).send(body);

    it('creates an account that can log in right away', async () => {
      const cookie = await sessionCookieFor('Super Admin SA01');

      const response = await create(NEW_USER, cookie).expect(201);

      expect(response.body).toEqual({
        id: 4,
        fullName: NEW_USER.fullName,
        role: Role.TEAM_MAIN_OFFICE,
        divisi: Divisi.TAX,
        isActive: true,
      });
      await login(NEW_USER.fullName, NEW_USER.password).expect(200);
    });

    it('normalizes the name before storing it', async () => {
      const cookie = await sessionCookieFor('Super Admin SA01');

      const response = await create(
        { ...NEW_USER, fullName: '  Rina   Wulandari  TX01 ' },
        cookie,
      ).expect(201);

      expect(response.body.fullName).toBe('Rina Wulandari TX01');
    });

    it('creates a superadmin when no divisi is sent', async () => {
      const cookie = await sessionCookieFor('Super Admin SA01');

      const response = await create(
        {
          fullName: 'Super Admin SA02',
          role: Role.SUPERADMIN,
          password: 'password-awal-1',
        },
        cookie,
      ).expect(201);

      expect(response.body).toMatchObject({
        role: Role.SUPERADMIN,
        divisi: null,
      });
    });

    it('rejects a superadmin that carries a divisi and stores nothing', async () => {
      const cookie = await sessionCookieFor('Super Admin SA01');

      const response = await create(
        {
          fullName: 'Super Admin SA02',
          role: Role.SUPERADMIN,
          divisi: Divisi.IT,
          password: 'password-awal-1',
        },
        cookie,
      ).expect(400);

      expect(response.body.message).toBe(ROLE_DIVISI_INVALID_MESSAGE);
      await login('Super Admin SA02', 'password-awal-1').expect(401);
    });

    it('answers 409 for a taken name, whatever its letter case', async () => {
      const cookie = await sessionCookieFor('Super Admin SA01');

      const response = await create(
        { ...NEW_USER, fullName: 'manager legal lg01' },
        cookie,
      ).expect(409);

      expect(response.body.message).toBe(FULL_NAME_TAKEN_MESSAGE);
    });

    it.each([
      ['a password that is too short', { password: 'pendek' }],
      ['an unexpected isActive field', { isActive: false }],
      ['an unexpected id field', { id: 1 }],
      ['an unknown role', { role: 'ADMIN' }],
      [
        'a name with a zero-width character',
        { fullName: 'Rina​Wulandari TX01' },
      ],
      ['a missing name', { fullName: undefined }],
    ])('rejects %s with 400', async (_label, override) => {
      const cookie = await sessionCookieFor('Super Admin SA01');

      await create({ ...NEW_USER, ...override }, cookie).expect(400);
      await login(NEW_USER.fullName, NEW_USER.password).expect(401);
    });
  });

  describe('PATCH /users/:id', () => {
    const patch = (id: number | string, body: object, cookie: string) =>
      request(server()).patch(`/users/${id}`).set('Cookie', cookie).send(body);

    it('updates the role and divisi and returns the account', async () => {
      const cookie = await sessionCookieFor('Super Admin SA01');

      const response = await patch(
        3,
        { role: Role.MANAGER_MAIN_OFFICE, divisi: Divisi.TAX },
        cookie,
      ).expect(200);

      expect(response.body).toEqual({
        id: 3,
        fullName: 'Staf IT IT01',
        role: Role.MANAGER_MAIN_OFFICE,
        divisi: Divisi.TAX,
        isActive: true,
      });
    });

    it('ends the target’s active session as soon as the account is deactivated', async () => {
      const staffCookie = await sessionCookieFor('Staf IT IT01');
      await request(server())
        .get('/auth/me')
        .set('Cookie', staffCookie)
        .expect(200);
      const cookie = await sessionCookieFor('Super Admin SA01');

      const response = await patch(3, { isActive: false }, cookie).expect(200);

      expect(response.body.isActive).toBe(false);
      const rejected = await request(server())
        .get('/auth/me')
        .set('Cookie', staffCookie)
        .expect(401);
      expect(rejected.body.message).toBe(INVALID_SESSION_MESSAGE);
      await login('Staf IT IT01').expect(401);
    });

    it('lets a reactivated account log in again', async () => {
      const cookie = await sessionCookieFor('Super Admin SA01');
      await patch(3, { isActive: false }, cookie).expect(200);

      await patch(3, { isActive: true }, cookie).expect(200);

      await login('Staf IT IT01').expect(200);
    });

    it('rejects a combination that would leave the account inconsistent', async () => {
      const cookie = await sessionCookieFor('Super Admin SA01');

      const response = await patch(3, { role: Role.SUPERADMIN }, cookie).expect(
        400,
      );

      expect(response.body.message).toBe(ROLE_DIVISI_INVALID_MESSAGE);
      const list = await request(server())
        .get('/users')
        .set('Cookie', cookie)
        .expect(200);
      expect(
        list.body.find((user: { id: number }) => user.id === 3),
      ).toMatchObject({
        role: Role.TEAM_MAIN_OFFICE,
        divisi: Divisi.IT,
      });
    });

    it('refuses to change the superadmin’s own role or status', async () => {
      const cookie = await sessionCookieFor('Super Admin SA01');

      const deactivate = await patch(1, { isActive: false }, cookie).expect(
        403,
      );
      expect(deactivate.body.message).toBe(SELF_CHANGE_FORBIDDEN_MESSAGE);
      await patch(
        1,
        { role: Role.TEAM_MAIN_OFFICE, divisi: Divisi.IT },
        cookie,
      ).expect(403);
      await request(server()).get('/auth/me').set('Cookie', cookie).expect(200);
    });

    it('answers 404 for an unknown account', async () => {
      const cookie = await sessionCookieFor('Super Admin SA01');

      const response = await patch(999, { isActive: false }, cookie).expect(
        404,
      );

      expect(response.body.message).toBe(USER_NOT_FOUND_MESSAGE);
    });

    it.each([
      ['an empty body', 3, {}],
      ['a null role', 3, { role: null }],
      ['a name change', 3, { fullName: 'Nama Lain XX01' }],
      ['a password change', 3, { password: 'password-baru-1' }],
      ['a non-numeric id', 'abc', { isActive: false }],
      ['an id of zero', 0, { isActive: false }],
    ])('rejects %s with 400', async (_label, id, body) => {
      const cookie = await sessionCookieFor('Super Admin SA01');

      await patch(id, body, cookie).expect(400);
    });
  });

  describe('PATCH /users/:id/reset-password', () => {
    const NEW_PASSWORD = 'password-baru-789';

    const reset = (id: number | string, body: object, cookie: string) =>
      request(server())
        .patch(`/users/${id}/reset-password`)
        .set('Cookie', cookie)
        .send(body);

    it('replaces the password and ends the owner’s older sessions', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() - 5_000);
      const staffCookie = await sessionCookieFor('Staf IT IT01');
      jest.restoreAllMocks();
      await request(server())
        .get('/auth/me')
        .set('Cookie', staffCookie)
        .expect(200);
      const cookie = await sessionCookieFor('Super Admin SA01');

      await reset(3, { newPassword: NEW_PASSWORD }, cookie).expect(204);

      await request(server())
        .get('/auth/me')
        .set('Cookie', staffCookie)
        .expect(401);
      await login('Staf IT IT01').expect(401);
      await login('Staf IT IT01', NEW_PASSWORD).expect(200);
    });

    it('keeps the superadmin’s own session valid', async () => {
      const cookie = await sessionCookieFor('Super Admin SA01');

      await reset(3, { newPassword: NEW_PASSWORD }, cookie).expect(204);

      await request(server()).get('/auth/me').set('Cookie', cookie).expect(200);
    });

    it('refuses to reset the superadmin’s own password here', async () => {
      const cookie = await sessionCookieFor('Super Admin SA01');

      const response = await reset(
        1,
        { newPassword: NEW_PASSWORD },
        cookie,
      ).expect(403);

      expect(response.body.message).toBe(SELF_RESET_FORBIDDEN_MESSAGE);
      await login('Super Admin SA01').expect(200);
    });

    it('answers 404 for an unknown account', async () => {
      const cookie = await sessionCookieFor('Super Admin SA01');

      await reset(999, { newPassword: NEW_PASSWORD }, cookie).expect(404);
    });

    it.each([
      ['a password that is too short', 3, { newPassword: 'pendek' }],
      ['a missing password', 3, {}],
      ['a password that is an object', 3, { newPassword: { not: '' } }],
      [
        'a current password field',
        3,
        { newPassword: NEW_PASSWORD, currentPassword: PASSWORD },
      ],
      ['a non-numeric id', 'abc', { newPassword: NEW_PASSWORD }],
    ])(
      'rejects %s with 400 and keeps the old password',
      async (_label, id, body) => {
        const cookie = await sessionCookieFor('Super Admin SA01');

        await reset(id, body, cookie).expect(400);
        await login('Staf IT IT01').expect(200);
      },
    );
  });
});

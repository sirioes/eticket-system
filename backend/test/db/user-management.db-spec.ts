import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { Divisi } from '../../src/common/enums/divisi.enum';
import { Role } from '../../src/common/enums/role.enum';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  assertTestDatabase,
  resetDatabase,
  seedUser,
  TEST_PASSWORD,
} from './test-database';

process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.COOKIE_SECURE = 'false';
process.env.CORS_ORIGIN = 'https://eticket.example';

const ADMIN = 'Super Admin DB01';
const STAFF = 'Staf IT DB02';
const NEW_PASSWORD = 'password-baru-789';

describe('User management on MySQL', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let staffId: number;

  const server = () => app.getHttpServer();

  const login = (fullName: string, password = TEST_PASSWORD) =>
    request(server()).post('/auth/login').send({ fullName, password });

  const sessionCookieFor = async (fullName: string) => {
    const response = await login(fullName).expect(200);
    const header = response.headers['set-cookie'];
    return (Array.isArray(header) ? header : [header])[0].split(';')[0];
  };

  const newUser = (overrides: object = {}) => ({
    fullName: 'Rina Wulandari DB03',
    role: Role.TEAM_MAIN_OFFICE,
    divisi: Divisi.TAX,
    password: 'password-awal-1',
    ...overrides,
  });

  beforeEach(async () => {
    assertTestDatabase();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await resetDatabase(prisma);
    await seedUser(prisma, ADMIN, Role.SUPERADMIN, null);
    staffId = (await seedUser(prisma, STAFF, Role.TEAM_MAIN_OFFICE, Divisi.IT))
      .id;
  });

  afterEach(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  it('stores a new account with a bcrypt hash and lets it log in', async () => {
    const cookie = await sessionCookieFor(ADMIN);

    const response = await request(server())
      .post('/users')
      .set('Cookie', cookie)
      .send(newUser())
      .expect(201);

    expect(response.body).toEqual({
      id: expect.any(Number),
      fullName: 'Rina Wulandari DB03',
      role: Role.TEAM_MAIN_OFFICE,
      divisi: Divisi.TAX,
      isActive: true,
    });
    const stored = await prisma.user.findUniqueOrThrow({
      where: { fullName: 'Rina Wulandari DB03' },
    });
    expect(stored.password).toMatch(/^\$2[aby]\$/);
    expect(stored.password).not.toContain('password-awal-1');
    await login('Rina Wulandari DB03', 'password-awal-1').expect(200);
  });

  it.each([
    ['the same name', STAFF],
    ['the same name in another letter case', STAFF.toUpperCase()],
  ])('answers 409 for %s and keeps a single row', async (_label, fullName) => {
    const cookie = await sessionCookieFor(ADMIN);

    await request(server())
      .post('/users')
      .set('Cookie', cookie)
      .send(newUser({ fullName }))
      .expect(409);

    expect(await prisma.user.count({ where: { fullName: STAFF } })).toBe(1);
  });

  it('keeps only one account when two identical creates arrive together', async () => {
    const cookie = await sessionCookieFor(ADMIN);

    const [first, second] = await Promise.all([
      request(server()).post('/users').set('Cookie', cookie).send(newUser()),
      request(server()).post('/users').set('Cookie', cookie).send(newUser()),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect(
      await prisma.user.count({ where: { fullName: 'Rina Wulandari DB03' } }),
    ).toBe(1);
  });

  it('lists accounts ordered by name without any password field', async () => {
    const cookie = await sessionCookieFor(ADMIN);

    const response = await request(server())
      .get('/users')
      .set('Cookie', cookie)
      .expect(200);

    expect(
      response.body.map((user: { fullName: string }) => user.fullName),
    ).toEqual([STAFF, ADMIN]);
    expect(JSON.stringify(response.body)).not.toMatch(/password/i);
  });

  it('applies role, divisi and status changes in the database', async () => {
    const cookie = await sessionCookieFor(ADMIN);

    await request(server())
      .patch(`/users/${staffId}`)
      .set('Cookie', cookie)
      .send({ role: Role.MANAGER_MAIN_OFFICE, divisi: Divisi.LEGAL })
      .expect(200);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: staffId },
    });
    expect(stored).toMatchObject({
      role: Role.MANAGER_MAIN_OFFICE,
      divisi: Divisi.LEGAL,
      isActive: true,
    });
  });

  it('rejects the next request of an account as soon as it is deactivated', async () => {
    const staffCookie = await sessionCookieFor(STAFF);
    await request(server())
      .get('/auth/me')
      .set('Cookie', staffCookie)
      .expect(200);
    const cookie = await sessionCookieFor(ADMIN);

    await request(server())
      .patch(`/users/${staffId}`)
      .set('Cookie', cookie)
      .send({ isActive: false })
      .expect(200);

    await request(server())
      .get('/auth/me')
      .set('Cookie', staffCookie)
      .expect(401);
    await login(STAFF).expect(401);
  });

  it('writes passwordChangedAt on reset and ends the owner’s older sessions', async () => {
    await prisma.user.update({
      where: { id: staffId },
      data: { passwordChangedAt: new Date(Date.now() - 60_000) },
    });
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() - 5_000);
    const staffCookie = await sessionCookieFor(STAFF);
    jest.restoreAllMocks();
    await request(server())
      .get('/auth/me')
      .set('Cookie', staffCookie)
      .expect(200);
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: staffId },
      select: { passwordChangedAt: true },
    });
    const cookie = await sessionCookieFor(ADMIN);

    await request(server())
      .patch(`/users/${staffId}/reset-password`)
      .set('Cookie', cookie)
      .send({ newPassword: NEW_PASSWORD })
      .expect(204);

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: staffId },
      select: { passwordChangedAt: true },
    });
    expect(after.passwordChangedAt.getTime()).toBeGreaterThan(
      before.passwordChangedAt.getTime(),
    );
    expect(after.passwordChangedAt.getMilliseconds()).toBe(0);
    await request(server())
      .get('/auth/me')
      .set('Cookie', staffCookie)
      .expect(401);
    await login(STAFF).expect(401);
    await login(STAFF, NEW_PASSWORD).expect(200);
  });
});

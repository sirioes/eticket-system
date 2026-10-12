import { Divisi } from '../../common/enums/divisi.enum';
import { Role } from '../../common/enums/role.enum';
import { AUTH_USER_SELECT } from '../../auth/infrastructure/prisma-user.repository';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DuplicateFullNameError } from '../application/ports/user-admin.repository';
import { PrismaUserAdminRepository } from './prisma-user-admin.repository';

const row = {
  id: 12,
  fullName: 'Rina Wulandari TX01',
  role: 'TEAM_MAIN_OFFICE',
  divisi: 'TAX',
  isActive: true,
  passwordChangedAt: new Date('2026-10-12T03:00:00Z'),
};

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('gagal', {
    code,
    clientVersion: 'test',
  });

describe('PrismaUserAdminRepository', () => {
  const userDelegate = {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const repository = new PrismaUserAdminRepository({
    user: userDelegate,
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('never selects the password column', () => {
    expect(AUTH_USER_SELECT).not.toHaveProperty('password');
  });

  describe('findAll', () => {
    it('lists users ordered by name, then id, mapped to AuthUser', async () => {
      userDelegate.findMany.mockResolvedValue([row]);

      await expect(repository.findAll()).resolves.toEqual([
        {
          id: 12,
          fullName: 'Rina Wulandari TX01',
          role: Role.TEAM_MAIN_OFFICE,
          divisi: Divisi.TAX,
          isActive: true,
          passwordChangedAt: row.passwordChangedAt,
        },
      ]);
      expect(userDelegate.findMany).toHaveBeenCalledWith({
        select: AUTH_USER_SELECT,
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      });
    });
  });

  describe('create', () => {
    const newUser = {
      fullName: 'Rina Wulandari TX01',
      role: Role.TEAM_MAIN_OFFICE,
      divisi: Divisi.TAX,
      passwordHash: 'hashed-password',
    };

    it('stores the hash as the password and returns a user without it', async () => {
      userDelegate.create.mockResolvedValue(row);

      const created = await repository.create(newUser);

      expect(userDelegate.create).toHaveBeenCalledWith({
        data: {
          fullName: 'Rina Wulandari TX01',
          password: 'hashed-password',
          role: Role.TEAM_MAIN_OFFICE,
          divisi: Divisi.TAX,
        },
        select: AUTH_USER_SELECT,
      });
      expect(created).not.toHaveProperty('password');
      expect(created).not.toHaveProperty('passwordHash');
      expect(created.id).toBe(12);
    });

    it('translates P2002 into DuplicateFullNameError', async () => {
      userDelegate.create.mockRejectedValue(prismaError('P2002'));

      await expect(repository.create(newUser)).rejects.toThrow(
        new DuplicateFullNameError(newUser.fullName),
      );
    });

    it.each([
      ['another Prisma error', prismaError('P2003')],
      ['a plain error', new Error('koneksi terputus')],
    ])('rethrows %s untouched', async (_label, failure) => {
      userDelegate.create.mockRejectedValue(failure);

      await expect(repository.create(newUser)).rejects.toBe(failure);
    });
  });

  describe('update', () => {
    it('writes only the provided fields to the right row', async () => {
      userDelegate.update.mockResolvedValue({ ...row, isActive: false });

      const updated = await repository.update(12, { isActive: false });

      expect(updated.isActive).toBe(false);
      const [args] = userDelegate.update.mock.calls[0];
      expect(args.where).toEqual({ id: 12 });
      expect(args.data).toEqual({ isActive: false });
      expect(args.select).toBe(AUTH_USER_SELECT);
    });

    it('clears the divisi when null is passed', async () => {
      userDelegate.update.mockResolvedValue({
        ...row,
        role: 'SUPERADMIN',
        divisi: null,
      });

      await repository.update(12, { role: Role.SUPERADMIN, divisi: null });

      expect(userDelegate.update.mock.calls[0][0].data).toEqual({
        role: Role.SUPERADMIN,
        divisi: null,
      });
    });
  });
});

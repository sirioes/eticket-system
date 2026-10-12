import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  PASSWORD_INVALID_CHARACTER_MESSAGE,
  PASSWORD_TOO_LONG_MESSAGE,
  PASSWORD_TOO_SHORT_MESSAGE,
} from '../../../auth/application/password-policy';
import { PasswordHasher } from '../../../auth/application/ports/password-hasher';
import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';
import { ROLE_DIVISI_INVALID_MESSAGE } from '../../users.constants';
import {
  DuplicateFullNameError,
  UserAdminRepository,
} from '../ports/user-admin.repository';
import {
  CreateUserCommand,
  CreateUserUseCase,
  FULL_NAME_INVALID_CHARACTER_MESSAGE,
  FULL_NAME_REQUIRED_MESSAGE,
  FULL_NAME_TAKEN_MESSAGE,
} from './create-user.use-case';

const command: CreateUserCommand = {
  fullName: 'Rina Wulandari TX01',
  role: Role.TEAM_MAIN_OFFICE,
  divisi: Divisi.TAX,
  password: 'password-awal-1',
};

const createdUser = {
  id: 12,
  fullName: 'Rina Wulandari TX01',
  role: Role.TEAM_MAIN_OFFICE,
  divisi: Divisi.TAX,
  isActive: true,
  passwordChangedAt: new Date('2026-10-12T03:00:00Z'),
};

describe('CreateUserUseCase', () => {
  let useCase: CreateUserUseCase;
  const userAdmin = { create: jest.fn() };
  const passwordHasher = { hash: jest.fn() };

  const create = (overrides: Partial<CreateUserCommand> = {}) =>
    useCase.execute({ ...command, ...overrides });

  beforeEach(async () => {
    jest.resetAllMocks();
    userAdmin.create.mockResolvedValue(createdUser);
    passwordHasher.hash.mockResolvedValue('hashed-password');

    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateUserUseCase,
        { provide: UserAdminRepository, useValue: userAdmin },
        { provide: PasswordHasher, useValue: passwordHasher },
      ],
    }).compile();

    useCase = moduleRef.get(CreateUserUseCase);
  });

  it('stores a normalized name and the password only as a hash', async () => {
    await expect(
      create({ fullName: '  Rina   Wulandari  TX01 ' }),
    ).resolves.toBe(createdUser);

    expect(passwordHasher.hash).toHaveBeenCalledWith('password-awal-1');
    expect(userAdmin.create).toHaveBeenCalledWith({
      fullName: 'Rina Wulandari TX01',
      role: Role.TEAM_MAIN_OFFICE,
      divisi: Divisi.TAX,
      passwordHash: 'hashed-password',
    });
    expect(JSON.stringify(userAdmin.create.mock.calls)).not.toContain(
      'password-awal-1',
    );
  });

  it.each([
    ['a blank name', '   ', FULL_NAME_REQUIRED_MESSAGE],
    [
      'a zero-width character',
      'Rina​Wulandari TX01',
      FULL_NAME_INVALID_CHARACTER_MESSAGE,
    ],
    [
      'a bidi control character',
      'Rina‮Wulandari TX01',
      FULL_NAME_INVALID_CHARACTER_MESSAGE,
    ],
    [
      'a control character',
      'Rina\u0007Wulandari TX01',
      FULL_NAME_INVALID_CHARACTER_MESSAGE,
    ],
    [
      'a lone surrogate',
      'Rina\uD800 TX01',
      FULL_NAME_INVALID_CHARACTER_MESSAGE,
    ],
  ])(
    'rejects %s before hashing or storing',
    async (_label, fullName, message) => {
      await expect(create({ fullName })).rejects.toThrow(
        new BadRequestException(message),
      );
      expect(passwordHasher.hash).not.toHaveBeenCalled();
      expect(userAdmin.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['SUPERADMIN with a divisi', Role.SUPERADMIN, Divisi.IT],
    ['a team role without a divisi', Role.TEAM_MAIN_OFFICE, null],
    ['a manager role without a divisi', Role.MANAGER_MAIN_OFFICE, null],
    ['a finance role outside FINANCE', Role.FINANCE_MAIN_OFFICE, Divisi.IT],
    [
      'a finance manager outside FINANCE',
      Role.FINANCE_MANAGER_MAIN_OFFICE,
      Divisi.TAX,
    ],
    [
      'a general team role inside FINANCE',
      Role.TEAM_MAIN_OFFICE,
      Divisi.FINANCE,
    ],
    [
      'a general manager role inside FINANCE',
      Role.MANAGER_MAIN_OFFICE,
      Divisi.FINANCE,
    ],
  ])('rejects %s', async (_label, role, divisi) => {
    await expect(create({ role, divisi })).rejects.toThrow(
      new BadRequestException(ROLE_DIVISI_INVALID_MESSAGE),
    );
    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(userAdmin.create).not.toHaveBeenCalled();
  });

  it.each([
    ['SUPERADMIN without a divisi', Role.SUPERADMIN, null],
    ['a finance staff in FINANCE', Role.FINANCE_MAIN_OFFICE, Divisi.FINANCE],
    [
      'a finance manager in FINANCE',
      Role.FINANCE_MANAGER_MAIN_OFFICE,
      Divisi.FINANCE,
    ],
    ['a manager in LEGAL', Role.MANAGER_MAIN_OFFICE, Divisi.LEGAL],
  ])('accepts %s', async (_label, role, divisi) => {
    await expect(create({ role, divisi })).resolves.toBe(createdUser);
  });

  it.each([
    ['too short', 'pendek', PASSWORD_TOO_SHORT_MESSAGE],
    ['longer than 72 bytes', 'a'.repeat(73), PASSWORD_TOO_LONG_MESSAGE],
    [
      'containing a lone surrogate',
      `abcdefg${'\uD800'}`,
      PASSWORD_INVALID_CHARACTER_MESSAGE,
    ],
  ])(
    'rejects a password that is %s before hashing',
    async (_label, password, message) => {
      await expect(create({ password })).rejects.toThrow(
        new BadRequestException(message),
      );
      expect(passwordHasher.hash).not.toHaveBeenCalled();
      expect(userAdmin.create).not.toHaveBeenCalled();
    },
  );

  it('answers 409 when the name is already taken', async () => {
    userAdmin.create.mockRejectedValue(
      new DuplicateFullNameError(command.fullName),
    );

    await expect(create()).rejects.toThrow(
      new ConflictException(FULL_NAME_TAKEN_MESSAGE),
    );
  });

  it('lets unexpected storage errors through untouched', async () => {
    const failure = new Error('koneksi terputus');
    userAdmin.create.mockRejectedValue(failure);

    await expect(create()).rejects.toBe(failure);
  });
});

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  PASSWORD_INVALID_CHARACTER_MESSAGE,
  PASSWORD_TOO_LONG_MESSAGE,
  PASSWORD_TOO_SHORT_MESSAGE,
} from '../../../auth/application/password-policy';
import { PasswordHasher } from '../../../auth/application/ports/password-hasher';
import { UserRepository } from '../../../auth/application/ports/user.repository';
import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';
import { USER_NOT_FOUND_MESSAGE } from '../../users.constants';
import {
  ResetUserPasswordUseCase,
  SELF_RESET_FORBIDDEN_MESSAGE,
} from './reset-user-password.use-case';

const target = {
  id: 7,
  fullName: 'Budi Santoso LG01',
  role: Role.MANAGER_MAIN_OFFICE,
  divisi: Divisi.LEGAL,
  isActive: true,
  passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('ResetUserPasswordUseCase', () => {
  let useCase: ResetUserPasswordUseCase;
  const users = { findAuthUserById: jest.fn(), updatePassword: jest.fn() };
  const passwordHasher = { hash: jest.fn() };

  const reset = (newPassword = 'password-baru-1', userId = 7) =>
    useCase.execute({ actorId: 1, userId, newPassword });

  beforeEach(async () => {
    jest.resetAllMocks();
    users.findAuthUserById.mockResolvedValue(target);
    passwordHasher.hash.mockResolvedValue('new-hash');

    const moduleRef = await Test.createTestingModule({
      providers: [
        ResetUserPasswordUseCase,
        { provide: UserRepository, useValue: users },
        { provide: PasswordHasher, useValue: passwordHasher },
      ],
    }).compile();

    useCase = moduleRef.get(ResetUserPasswordUseCase);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('forbids resetting the actor’s own password before touching anything', async () => {
    await expect(reset('password-baru-1', 1)).rejects.toThrow(
      new ForbiddenException(SELF_RESET_FORBIDDEN_MESSAGE),
    );
    expect(users.findAuthUserById).not.toHaveBeenCalled();
    expect(users.updatePassword).not.toHaveBeenCalled();
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
    'rejects a password that is %s before looking anything up',
    async (_label, password, message) => {
      await expect(reset(password)).rejects.toThrow(
        new BadRequestException(message),
      );
      expect(users.findAuthUserById).not.toHaveBeenCalled();
      expect(passwordHasher.hash).not.toHaveBeenCalled();
    },
  );

  it('answers 404 for an unknown account', async () => {
    users.findAuthUserById.mockResolvedValue(null);

    await expect(reset('password-baru-1', 999)).rejects.toThrow(
      new NotFoundException(USER_NOT_FOUND_MESSAGE),
    );
    expect(users.updatePassword).not.toHaveBeenCalled();
  });

  it('stores the new hash with the change time truncated to whole seconds', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(Date.parse('2026-10-12T03:00:00.750Z'));

    await expect(reset()).resolves.toBeUndefined();

    expect(passwordHasher.hash).toHaveBeenCalledWith('password-baru-1');
    expect(users.updatePassword).toHaveBeenCalledWith(
      7,
      'new-hash',
      new Date('2026-10-12T03:00:00.000Z'),
    );
  });

  it('also resets the password of a deactivated account', async () => {
    users.findAuthUserById.mockResolvedValue({ ...target, isActive: false });

    await expect(reset()).resolves.toBeUndefined();
    expect(users.updatePassword).toHaveBeenCalledTimes(1);
  });
});

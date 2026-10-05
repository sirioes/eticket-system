import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';
import { INVALID_SESSION_MESSAGE } from '../../auth.constants';
import { UserCredentials } from '../../domain/auth-user';
import { AccessTokenIssuer } from '../ports/access-token-issuer';
import { PasswordHasher } from '../ports/password-hasher';
import { UserRepository } from '../ports/user.repository';
import {
  ChangePasswordUseCase,
  CURRENT_PASSWORD_INCORRECT_MESSAGE,
  PASSWORD_INVALID_CHARACTER_MESSAGE,
  PASSWORD_TOO_LONG_MESSAGE,
  PASSWORD_TOO_SHORT_MESSAGE,
  PASSWORD_UNCHANGED_MESSAGE,
} from './change-password.use-case';

const activeUser: UserCredentials = {
  id: 7,
  fullName: 'Budi Santoso',
  role: Role.MANAGER_MAIN_OFFICE,
  divisi: Divisi.LEGAL,
  isActive: true,
  passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
  passwordHash: 'stored-hash',
};

describe('ChangePasswordUseCase', () => {
  let useCase: ChangePasswordUseCase;
  const users = { findCredentialsById: jest.fn(), updatePassword: jest.fn() };
  const passwordHasher = { verify: jest.fn(), hash: jest.fn() };
  const tokenIssuer = { issue: jest.fn() };

  const change = (newPassword: string, currentPassword = 'lama-12345') =>
    useCase.execute({ userId: 7, currentPassword, newPassword });

  beforeEach(async () => {
    jest.resetAllMocks();
    users.findCredentialsById.mockResolvedValue(activeUser);
    passwordHasher.verify.mockResolvedValue(true);
    passwordHasher.hash.mockResolvedValue('new-hash');
    tokenIssuer.issue.mockResolvedValue('new-token');

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChangePasswordUseCase,
        { provide: UserRepository, useValue: users },
        { provide: PasswordHasher, useValue: passwordHasher },
        { provide: AccessTokenIssuer, useValue: tokenIssuer },
      ],
    }).compile();

    useCase = moduleRef.get(ChangePasswordUseCase);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['longer than 72 bytes', 'a'.repeat(73), PASSWORD_TOO_LONG_MESSAGE],
    ['a lone surrogate', `abcdefg${'\uD800'}`, PASSWORD_INVALID_CHARACTER_MESSAGE],
    ['shorter than 8 characters', 'pendek', PASSWORD_TOO_SHORT_MESSAGE],
    ['4 emoji counted as 4 characters', '😀'.repeat(4), PASSWORD_TOO_SHORT_MESSAGE],
  ])('rejects a new password %s before touching storage', async (_label, newPassword, message) => {
    await expect(change(newPassword)).rejects.toThrow(new BadRequestException(message));
    expect(users.findCredentialsById).not.toHaveBeenCalled();
    expect(passwordHasher.verify).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing user', null],
    ['an inactive user', { ...activeUser, isActive: false }],
  ])('rejects %s as an invalid session', async (_label, credentials) => {
    users.findCredentialsById.mockResolvedValue(credentials);

    await expect(change('baru-12345')).rejects.toThrow(
      new UnauthorizedException(INVALID_SESSION_MESSAGE),
    );
    expect(users.updatePassword).not.toHaveBeenCalled();
  });

  it('rejects a wrong current password with 400 so the session is kept', async () => {
    passwordHasher.verify.mockResolvedValue(false);

    await expect(change('baru-12345', 'salah-12345')).rejects.toThrow(
      new BadRequestException(CURRENT_PASSWORD_INCORRECT_MESSAGE),
    );
    expect(passwordHasher.verify).toHaveBeenCalledWith('salah-12345', 'stored-hash');
    expect(users.updatePassword).not.toHaveBeenCalled();
    expect(tokenIssuer.issue).not.toHaveBeenCalled();
  });

  it('rejects a new password that equals the current one', async () => {
    await expect(change('lama-12345')).rejects.toThrow(
      new BadRequestException(PASSWORD_UNCHANGED_MESSAGE),
    );
    expect(users.updatePassword).not.toHaveBeenCalled();
  });

  it('stores the new hash with the change time truncated to whole seconds', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-05T03:00:00.750Z'));

    await change('baru-12345');

    expect(passwordHasher.hash).toHaveBeenCalledWith('baru-12345');
    expect(users.updatePassword).toHaveBeenCalledWith(
      7,
      'new-hash',
      new Date('2026-10-05T03:00:00.000Z'),
    );
  });

  it('accepts a 72-byte password', async () => {
    await expect(change('😀'.repeat(18))).resolves.toBe('new-token');
  });

  it('issues a token for the same user only after the password is stored', async () => {
    await expect(change('baru-12345')).resolves.toBe('new-token');

    expect(tokenIssuer.issue).toHaveBeenCalledWith({ sub: 7 });
    expect(users.updatePassword.mock.invocationCallOrder[0]).toBeLessThan(
      tokenIssuer.issue.mock.invocationCallOrder[0],
    );
  });
});
import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';
import { INVALID_SESSION_MESSAGE } from '../../auth.constants';
import { AuthUser } from '../../domain/auth-user';
import { UserRepository } from '../ports/user.repository';
import { ValidateSessionUseCase } from './validate-session.use-case';

const passwordChangedAt = new Date('2026-01-01T00:00:00.500Z');
const changedAtSeconds = Math.floor(passwordChangedAt.getTime() / 1000);

const activeUser: AuthUser = {
  id: 7,
  fullName: 'Budi Santoso',
  role: Role.MANAGER_MAIN_OFFICE,
  divisi: Divisi.LEGAL,
  isActive: true,
  passwordChangedAt,
};

describe('ValidateSessionUseCase', () => {
  let useCase: ValidateSessionUseCase;
  const users = { findCredentialsByFullName: jest.fn(), findAuthUserById: jest.fn() };
  const invalidSession = new UnauthorizedException(INVALID_SESSION_MESSAGE);

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [ValidateSessionUseCase, { provide: UserRepository, useValue: users }],
    }).compile();

    useCase = moduleRef.get(ValidateSessionUseCase);
  });

  it('returns the current user for a valid payload', async () => {
    users.findAuthUserById.mockResolvedValue(activeUser);

    await expect(useCase.execute({ sub: 7, iat: changedAtSeconds + 60 })).resolves.toEqual(activeUser);
    expect(users.findAuthUserById).toHaveBeenCalledWith(7);
  });

  it.each([
    ['a string sub', { sub: '7', iat: changedAtSeconds + 60 }],
    ['a fractional sub', { sub: 7.5, iat: changedAtSeconds + 60 }],
    ['a non-positive sub', { sub: 0, iat: changedAtSeconds + 60 }],
    ['a missing sub', { iat: changedAtSeconds + 60 }],
    ['a missing iat', { sub: 7 }],
  ])('rejects %s without querying the database', async (_label, payload) => {
    await expect(useCase.execute(payload)).rejects.toThrow(invalidSession);
    expect(users.findAuthUserById).not.toHaveBeenCalled();
  });

  it('rejects when the user no longer exists', async () => {
    users.findAuthUserById.mockResolvedValue(null);

    await expect(useCase.execute({ sub: 7, iat: changedAtSeconds + 60 })).rejects.toThrow(invalidSession);
  });

  it('rejects an inactive user', async () => {
    users.findAuthUserById.mockResolvedValue({ ...activeUser, isActive: false });

    await expect(useCase.execute({ sub: 7, iat: changedAtSeconds + 60 })).rejects.toThrow(invalidSession);
  });

  it('rejects a token issued before the last password change', async () => {
    users.findAuthUserById.mockResolvedValue(activeUser);

    await expect(useCase.execute({ sub: 7, iat: changedAtSeconds - 1 })).rejects.toThrow(invalidSession);
  });

  it('accepts a token issued in the same second as the password change', async () => {
    users.findAuthUserById.mockResolvedValue(activeUser);

    await expect(useCase.execute({ sub: 7, iat: changedAtSeconds })).resolves.toEqual(activeUser);
  });
});
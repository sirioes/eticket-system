import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';
import { UserCredentials } from '../../domain/auth-user';
import { AccessTokenIssuer } from '../ports/access-token-issuer';
import { PasswordHasher } from '../ports/password-hasher';
import { UserRepository } from '../ports/user.repository';
import { INVALID_CREDENTIALS_MESSAGE, LoginUseCase } from './login.use-case';

const activeUser: UserCredentials = {
  id: 7,
  fullName: 'Budi Santoso',
  role: Role.MANAGER_MAIN_OFFICE,
  divisi: Divisi.LEGAL,
  isActive: true,
  passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
  passwordHash: 'stored-hash',
};

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  const users = { findCredentialsByFullName: jest.fn(), findAuthUserById: jest.fn() };
  const passwordHasher = { verify: jest.fn() };
  const tokenIssuer = { issue: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    tokenIssuer.issue.mockResolvedValue('signed-token');

    const moduleRef = await Test.createTestingModule({
      providers: [
        LoginUseCase,
        { provide: UserRepository, useValue: users },
        { provide: PasswordHasher, useValue: passwordHasher },
        { provide: AccessTokenIssuer, useValue: tokenIssuer },
      ],
    }).compile();

    useCase = moduleRef.get(LoginUseCase);
  });

  it('returns a token and the user without the password hash on success', async () => {
    users.findCredentialsByFullName.mockResolvedValue(activeUser);
    passwordHasher.verify.mockResolvedValue(true);

    const result = await useCase.execute({ fullName: 'Budi Santoso', password: 'benar123' });

    expect(result.accessToken).toBe('signed-token');
    expect(result.user.id).toBe(7);
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('signs a token that only carries the user id', async () => {
    users.findCredentialsByFullName.mockResolvedValue(activeUser);
    passwordHasher.verify.mockResolvedValue(true);

    await useCase.execute({ fullName: 'Budi Santoso', password: 'benar123' });

    expect(tokenIssuer.issue).toHaveBeenCalledWith({ sub: 7 });
  });

  it('normalizes the full name before looking it up', async () => {
    users.findCredentialsByFullName.mockResolvedValue(activeUser);
    passwordHasher.verify.mockResolvedValue(true);

    await useCase.execute({ fullName: '  Budi    Santoso ', password: 'benar123' });

    expect(users.findCredentialsByFullName).toHaveBeenCalledWith('Budi Santoso');
  });

  it('rejects an unknown user but still runs password verification', async () => {
    users.findCredentialsByFullName.mockResolvedValue(null);
    passwordHasher.verify.mockResolvedValue(false);

    const attempt = useCase.execute({ fullName: 'Tidak Ada', password: 'apa-saja' });

    await expect(attempt).rejects.toThrow(new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE));
    expect(passwordHasher.verify).toHaveBeenCalledWith('apa-saja', null);
    expect(tokenIssuer.issue).not.toHaveBeenCalled();
  });

  it('rejects a wrong password with the same message', async () => {
    users.findCredentialsByFullName.mockResolvedValue(activeUser);
    passwordHasher.verify.mockResolvedValue(false);

    await expect(
      useCase.execute({ fullName: 'Budi Santoso', password: 'salah' }),
    ).rejects.toThrow(new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE));
    expect(tokenIssuer.issue).not.toHaveBeenCalled();
  });

  it('rejects an inactive user with the same message even when the password is correct', async () => {
    users.findCredentialsByFullName.mockResolvedValue({ ...activeUser, isActive: false });
    passwordHasher.verify.mockResolvedValue(true);

    await expect(
      useCase.execute({ fullName: 'Budi Santoso', password: 'benar123' }),
    ).rejects.toThrow(new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE));
    expect(passwordHasher.verify).toHaveBeenCalledWith('benar123', 'stored-hash');
    expect(tokenIssuer.issue).not.toHaveBeenCalled();
  });
});
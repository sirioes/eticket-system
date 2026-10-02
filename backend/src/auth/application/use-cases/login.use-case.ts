import { Injectable, UnauthorizedException } from '@nestjs/common';
import { normalizeFullName } from '../../../common/utils/normalize-full-name';
import { AuthUser } from '../../domain/auth-user';
import { AccessTokenIssuer } from '../ports/access-token-issuer';
import { PasswordHasher } from '../ports/password-hasher';
import { UserRepository } from '../ports/user.repository';

export const INVALID_CREDENTIALS_MESSAGE = 'Username atau password salah';

export interface LoginCommand {
  fullName: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  user: AuthUser;
}

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenIssuer: AccessTokenIssuer,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const credentials = await this.users.findCredentialsByFullName(
      normalizeFullName(command.fullName),
    );

    const passwordMatches = await this.passwordHasher.verify(
      command.password,
      credentials?.passwordHash ?? null,
    );

    if (!credentials || !passwordMatches || !credentials.isActive) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const user: AuthUser = {
      id: credentials.id,
      fullName: credentials.fullName,
      role: credentials.role,
      divisi: credentials.divisi,
      isActive: credentials.isActive,
      passwordChangedAt: credentials.passwordChangedAt,
    };

    const accessToken = await this.tokenIssuer.issue({ sub: user.id });

    return { accessToken, user };
  }
}
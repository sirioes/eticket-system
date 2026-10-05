import { Injectable, UnauthorizedException } from '@nestjs/common';
import { INVALID_SESSION_MESSAGE } from '../../auth.constants';
import { AuthUser } from '../../domain/auth-user';
import { UserRepository } from '../ports/user.repository';

export interface VerifiedTokenPayload {
  sub?: unknown;
  iat?: unknown;
}

@Injectable()
export class ValidateSessionUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(payload: VerifiedTokenPayload): Promise<AuthUser> {
    const { sub, iat } = payload;

    if (
      typeof sub !== 'number' ||
      !Number.isSafeInteger(sub) ||
      sub <= 0 ||
      typeof iat !== 'number'
    ) {
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    const user = await this.users.findAuthUserById(sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    const passwordChangedAtSeconds = Math.floor(user.passwordChangedAt.getTime() / 1000);

    if (iat < passwordChangedAtSeconds) {
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    return user;
  }
}
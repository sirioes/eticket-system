import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { INVALID_SESSION_MESSAGE } from '../../auth.constants';
import { assertValidNewPassword, currentPasswordChangeTime } from '../password-policy';
import { AccessTokenIssuer } from '../ports/access-token-issuer';
import { PasswordHasher } from '../ports/password-hasher';
import { UserRepository } from '../ports/user.repository';

export const CURRENT_PASSWORD_INCORRECT_MESSAGE = 'Password lama salah';

export const PASSWORD_UNCHANGED_MESSAGE = 'Password baru harus berbeda dari password lama';

export interface ChangePasswordCommand {
  userId: number;
  currentPassword: string;
  newPassword: string;
}

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenIssuer: AccessTokenIssuer,
  ) {}

  async execute(command: ChangePasswordCommand): Promise<string> {
    const { userId, currentPassword, newPassword } = command;

    assertValidNewPassword(newPassword);

    const credentials = await this.users.findCredentialsById(userId);

    if (!credentials || !credentials.isActive) {
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    const currentMatches = await this.passwordHasher.verify(
      currentPassword,
      credentials.passwordHash,
    );

    if (!currentMatches) {
      throw new BadRequestException(CURRENT_PASSWORD_INCORRECT_MESSAGE);
    }

    if (newPassword === currentPassword) {
      throw new BadRequestException(PASSWORD_UNCHANGED_MESSAGE);
    }

    const passwordHash = await this.passwordHasher.hash(newPassword);

    await this.users.updatePassword(userId, passwordHash, currentPasswordChangeTime());

    return this.tokenIssuer.issue({ sub: userId });
  }
}

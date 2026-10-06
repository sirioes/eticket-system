import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { hasLoneSurrogate } from '../../../common/utils/text-safety';
import { INVALID_SESSION_MESSAGE } from '../../auth.constants';
import { AccessTokenIssuer } from '../ports/access-token-issuer';
import { PasswordHasher } from '../ports/password-hasher';
import { UserRepository } from '../ports/user.repository';

const MIN_PASSWORD_LENGTH = 8;

const MAX_PASSWORD_BYTES = 72;

export const PASSWORD_TOO_SHORT_MESSAGE = `Password baru minimal ${MIN_PASSWORD_LENGTH} karakter`;

export const PASSWORD_TOO_LONG_MESSAGE = 'Password baru terlalu panjang';

export const PASSWORD_INVALID_CHARACTER_MESSAGE = 'Password baru mengandung karakter tidak valid';

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

    if (Buffer.byteLength(newPassword, 'utf8') > MAX_PASSWORD_BYTES) {
      throw new BadRequestException(PASSWORD_TOO_LONG_MESSAGE);
    }

    if (hasLoneSurrogate(newPassword)) {
      throw new BadRequestException(PASSWORD_INVALID_CHARACTER_MESSAGE);
    }

    if ([...newPassword].length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(PASSWORD_TOO_SHORT_MESSAGE);
    }

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
    const passwordChangedAt = new Date(Math.floor(Date.now() / 1000) * 1000);

    await this.users.updatePassword(userId, passwordHash, passwordChangedAt);

    return this.tokenIssuer.issue({ sub: userId });
  }
}
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  assertValidNewPassword,
  currentPasswordChangeTime,
} from '../../../auth/application/password-policy';
import { PasswordHasher } from '../../../auth/application/ports/password-hasher';
import { UserRepository } from '../../../auth/application/ports/user.repository';
import { USER_NOT_FOUND_MESSAGE } from '../../users.constants';

export const SELF_RESET_FORBIDDEN_MESSAGE =
  'Gunakan menu Ganti Password untuk mengubah password akun Anda sendiri';

export interface ResetUserPasswordCommand {
  actorId: number;
  userId: number;
  newPassword: string;
}

@Injectable()
export class ResetUserPasswordUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(command: ResetUserPasswordCommand): Promise<void> {
    const { actorId, userId, newPassword } = command;

    if (actorId === userId) {
      throw new ForbiddenException(SELF_RESET_FORBIDDEN_MESSAGE);
    }

    assertValidNewPassword(newPassword);

    const target = await this.users.findAuthUserById(userId);

    if (!target) {
      throw new NotFoundException(USER_NOT_FOUND_MESSAGE);
    }

    const passwordHash = await this.passwordHasher.hash(newPassword);

    await this.users.updatePassword(
      userId,
      passwordHash,
      currentPasswordChangeTime(),
    );
  }
}

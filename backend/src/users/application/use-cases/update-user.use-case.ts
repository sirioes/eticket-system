import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRepository } from '../../../auth/application/ports/user.repository';
import { AuthUser } from '../../../auth/domain/auth-user';
import { Divisi } from '../../../common/enums/divisi.enum';
import { isValidRoleDivisiCombo } from '../../../common/enums/role-divisi-validator';
import { Role } from '../../../common/enums/role.enum';
import {
  ROLE_DIVISI_INVALID_MESSAGE,
  USER_NOT_FOUND_MESSAGE,
} from '../../users.constants';
import { UserAdminRepository } from '../ports/user-admin.repository';

export const NO_CHANGES_MESSAGE = 'Tidak ada perubahan yang dikirim';

export const SELF_CHANGE_FORBIDDEN_MESSAGE =
  'Anda tidak dapat mengubah role atau status akun Anda sendiri';

export interface UpdateUserCommand {
  actor: AuthUser;
  userId: number;
  role?: Role;
  divisi?: Divisi | null;
  isActive?: boolean;
}

@Injectable()
export class UpdateUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly userAdmin: UserAdminRepository,
  ) {}

  async execute(command: UpdateUserCommand): Promise<AuthUser> {
    const { actor, userId, role, divisi, isActive } = command;

    if (role === undefined && divisi === undefined && isActive === undefined) {
      throw new BadRequestException(NO_CHANGES_MESSAGE);
    }

    if (actor.id === userId && (role !== undefined || isActive !== undefined)) {
      throw new ForbiddenException(SELF_CHANGE_FORBIDDEN_MESSAGE);
    }

    const current = await this.users.findAuthUserById(userId);

    if (!current) {
      throw new NotFoundException(USER_NOT_FOUND_MESSAGE);
    }

    const nextRole = role ?? current.role;
    const nextDivisi = divisi === undefined ? current.divisi : divisi;

    if (!isValidRoleDivisiCombo(nextRole, nextDivisi)) {
      throw new BadRequestException(ROLE_DIVISI_INVALID_MESSAGE);
    }

    return this.userAdmin.update(userId, { role, divisi, isActive });
  }
}

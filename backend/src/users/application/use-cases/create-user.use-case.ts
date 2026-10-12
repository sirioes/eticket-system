import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { assertValidNewPassword } from '../../../auth/application/password-policy';
import { PasswordHasher } from '../../../auth/application/ports/password-hasher';
import { AuthUser } from '../../../auth/domain/auth-user';
import { Divisi } from '../../../common/enums/divisi.enum';
import { isValidRoleDivisiCombo } from '../../../common/enums/role-divisi-validator';
import { Role } from '../../../common/enums/role.enum';
import { normalizeFullName } from '../../../common/utils/normalize-full-name';
import {
  hasLoneSurrogate,
  hasUnsafeInvisibleCharacter,
} from '../../../common/utils/text-safety';
import { ROLE_DIVISI_INVALID_MESSAGE } from '../../users.constants';
import {
  DuplicateFullNameError,
  UserAdminRepository,
} from '../ports/user-admin.repository';

export const FULL_NAME_REQUIRED_MESSAGE = 'Nama wajib diisi';

export const FULL_NAME_INVALID_CHARACTER_MESSAGE =
  'Nama mengandung karakter tidak valid';

export const FULL_NAME_TAKEN_MESSAGE = 'Nama sudah terdaftar';

export interface CreateUserCommand {
  fullName: string;
  role: Role;
  divisi: Divisi | null;
  password: string;
}

@Injectable()
export class CreateUserUseCase {
  constructor(
    private readonly userAdmin: UserAdminRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(command: CreateUserCommand): Promise<AuthUser> {
    const fullName = normalizeFullName(command.fullName);

    if (fullName === '') {
      throw new BadRequestException(FULL_NAME_REQUIRED_MESSAGE);
    }

    if (hasLoneSurrogate(fullName) || hasUnsafeInvisibleCharacter(fullName)) {
      throw new BadRequestException(FULL_NAME_INVALID_CHARACTER_MESSAGE);
    }

    if (!isValidRoleDivisiCombo(command.role, command.divisi)) {
      throw new BadRequestException(ROLE_DIVISI_INVALID_MESSAGE);
    }

    assertValidNewPassword(command.password);

    const passwordHash = await this.passwordHasher.hash(command.password);

    try {
      return await this.userAdmin.create({
        fullName,
        role: command.role,
        divisi: command.divisi,
        passwordHash,
      });
    } catch (error) {
      if (error instanceof DuplicateFullNameError) {
        throw new ConflictException(FULL_NAME_TAKEN_MESSAGE);
      }
      throw error;
    }
  }
}

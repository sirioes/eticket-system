import { AuthUser } from '../../../auth/domain/auth-user';
import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';

export interface NewUser {
  readonly fullName: string;
  readonly role: Role;
  readonly divisi: Divisi | null;
  readonly passwordHash: string;
}

export interface UserChanges {
  readonly role?: Role;
  readonly divisi?: Divisi | null;
  readonly isActive?: boolean;
}

export class DuplicateFullNameError extends Error {
  constructor(fullName: string) {
    super(`Nama ${fullName} sudah dipakai`);
  }
}

export abstract class UserAdminRepository {
  abstract findAll(): Promise<AuthUser[]>;

  abstract create(user: NewUser): Promise<AuthUser>;

  abstract update(id: number, changes: UserChanges): Promise<AuthUser>;
}

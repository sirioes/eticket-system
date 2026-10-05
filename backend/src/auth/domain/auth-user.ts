import { Divisi } from '../../common/enums/divisi.enum';
import { Role } from '../../common/enums/role.enum';

export interface AuthUser {
  readonly id: number;
  readonly fullName: string;
  readonly role: Role;
  readonly divisi: Divisi | null;
  readonly isActive: boolean;
  readonly passwordChangedAt: Date;
}

export interface UserCredentials extends AuthUser {
  readonly passwordHash: string;
}
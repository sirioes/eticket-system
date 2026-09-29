import { Divisi } from '../../common/enums/divisi.enum';
import { Role } from '../../common/enums/role.enum';
import { AuthUser, UserCredentials } from '../domain/auth-user';

export interface AuthUserRow {
  id: number;
  fullName: string;
  role: string;
  divisi: string | null;
  isActive: boolean;
  passwordChangedAt: Date;
}

export interface UserCredentialsRow extends AuthUserRow {
  password: string;
}

const ROLE_VALUES: readonly string[] = Object.values(Role);
const DIVISI_VALUES: readonly string[] = Object.values(Divisi);

function isRole(value: string): value is Role {
  return ROLE_VALUES.includes(value);
}

function isDivisi(value: string): value is Divisi {
  return DIVISI_VALUES.includes(value);
}

function toRole(value: string): Role {
  if (!isRole(value)) {
    throw new Error(`Unknown role value from database: "${value}"`);
  }
  return value;
}

function toDivisi(value: string | null): Divisi | null {
  if (value === null) return null;
  if (!isDivisi(value)) {
    throw new Error(`Unknown divisi value from database: "${value}"`);
  }
  return value;
}

export function toAuthUser(row: AuthUserRow): AuthUser {
  return {
    id: row.id,
    fullName: row.fullName,
    role: toRole(row.role),
    divisi: toDivisi(row.divisi),
    isActive: row.isActive,
    passwordChangedAt: row.passwordChangedAt,
  };
}

export function toUserCredentials(row: UserCredentialsRow): UserCredentials {
  return {
    ...toAuthUser(row),
    passwordHash: row.password,
  };
}
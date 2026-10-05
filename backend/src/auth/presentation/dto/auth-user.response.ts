import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';
import { AuthUser } from '../../domain/auth-user';

export interface AuthUserResponse {
  id: number;
  fullName: string;
  role: Role;
  divisi: Divisi | null;
}

export function toAuthUserResponse(user: AuthUser): AuthUserResponse {
  return {
    id: user.id,
    fullName: user.fullName,
    role: user.role,
    divisi: user.divisi,
  };
}
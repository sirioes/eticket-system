import { AuthUser } from '../../../auth/domain/auth-user';
import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';

export interface ManagedUserResponse {
  id: number;
  fullName: string;
  role: Role;
  divisi: Divisi | null;
  isActive: boolean;
}

export function toManagedUserResponse(user: AuthUser): ManagedUserResponse {
  return {
    id: user.id,
    fullName: user.fullName,
    role: user.role,
    divisi: user.divisi,
    isActive: user.isActive,
  };
}

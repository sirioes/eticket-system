import { SetMetadata } from '@nestjs/common';
import { Role } from '../../../common/enums/role.enum';

export const ROLES_KEY = 'roles';

export const ALL_ROLES: readonly Role[] = Object.values(Role);

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const AnyRole = () => SetMetadata(ROLES_KEY, ALL_ROLES);
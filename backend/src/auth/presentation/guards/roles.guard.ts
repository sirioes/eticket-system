import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../../common/enums/role.enum';
import { FORBIDDEN_MESSAGE } from '../../auth.constants';
import type { AuthUser } from '../../domain/auth-user';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const allowedRoles = this.reflector.getAllAndOverride<readonly Role[] | undefined>(ROLES_KEY, targets);
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;

    if (!allowedRoles || allowedRoles.length === 0 || !user || !allowedRoles.includes(user.role)) {
      throw new ForbiddenException(FORBIDDEN_MESSAGE);
    }

    return true;
  }
}
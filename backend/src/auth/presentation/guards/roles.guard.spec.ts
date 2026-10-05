import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';
import { FORBIDDEN_MESSAGE } from '../../auth.constants';
import { AuthUser } from '../../domain/auth-user';
import { Public } from '../decorators/public.decorator';
import { AnyRole, Roles } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

const userWith = (role: Role): AuthUser => ({
  id: 7,
  fullName: 'Budi Santoso',
  role,
  divisi: role === Role.SUPERADMIN ? null : Divisi.LEGAL,
  isActive: true,
  passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
});

class NoRolesController {
  undecorated() {}

  @Roles()
  emptyRoles() {}

  @Public()
  open() {}

  @Roles(Role.SUPERADMIN)
  superadminOnly() {}

  @AnyRole()
  anyone() {}
}

@Roles(Role.MANAGER_MAIN_OFFICE, Role.FINANCE_MANAGER_MAIN_OFFICE)
class ManagerController {
  inherited() {}

  @Roles(Role.SUPERADMIN)
  overridden() {}
}

function contextFor(
  controller: { prototype: object },
  handler: string,
  user?: AuthUser,
): ExecutionContext {
  return {
    getClass: () => controller,
    getHandler: () => (controller.prototype as Record<string, unknown>)[handler],
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  const forbidden = new ForbiddenException(FORBIDDEN_MESSAGE);

  it('lets a @Public() handler through without a user', () => {
    expect(guard.canActivate(contextFor(NoRolesController, 'open'))).toBe(true);
  });

  it('denies a handler that declares no roles at all', () => {
    expect(() =>
      guard.canActivate(contextFor(NoRolesController, 'undecorated', userWith(Role.SUPERADMIN))),
    ).toThrow(forbidden);
  });

  it('denies a handler with an empty @Roles()', () => {
    expect(() =>
      guard.canActivate(contextFor(NoRolesController, 'emptyRoles', userWith(Role.SUPERADMIN))),
    ).toThrow(forbidden);
  });

  it('denies when there is no authenticated user', () => {
    expect(() => guard.canActivate(contextFor(NoRolesController, 'superadminOnly'))).toThrow(forbidden);
  });

  it('allows a user whose role is listed', () => {
    expect(guard.canActivate(contextFor(NoRolesController, 'superadminOnly', userWith(Role.SUPERADMIN)))).toBe(true);
  });

  it('denies a user whose role is not listed', () => {
    expect(() =>
      guard.canActivate(contextFor(NoRolesController, 'superadminOnly', userWith(Role.MANAGER_MAIN_OFFICE))),
    ).toThrow(forbidden);
  });

  it.each(Object.values(Role))('allows %s on an @AnyRole() handler', (role) => {
    expect(guard.canActivate(contextFor(NoRolesController, 'anyone', userWith(role)))).toBe(true);
  });

  it('applies class-level roles to handlers without their own @Roles()', () => {
    expect(guard.canActivate(contextFor(ManagerController, 'inherited', userWith(Role.MANAGER_MAIN_OFFICE)))).toBe(true);
    expect(() =>
      guard.canActivate(contextFor(ManagerController, 'inherited', userWith(Role.TEAM_MAIN_OFFICE))),
    ).toThrow(forbidden);
  });

  it('lets handler-level roles override class-level roles', () => {
    expect(guard.canActivate(contextFor(ManagerController, 'overridden', userWith(Role.SUPERADMIN)))).toBe(true);
    expect(() =>
      guard.canActivate(contextFor(ManagerController, 'overridden', userWith(Role.MANAGER_MAIN_OFFICE))),
    ).toThrow(forbidden);
  });
});
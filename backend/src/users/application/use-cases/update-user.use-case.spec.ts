import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRepository } from '../../../auth/application/ports/user.repository';
import { AuthUser } from '../../../auth/domain/auth-user';
import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';
import {
  ROLE_DIVISI_INVALID_MESSAGE,
  USER_NOT_FOUND_MESSAGE,
} from '../../users.constants';
import { UserAdminRepository } from '../ports/user-admin.repository';
import {
  NO_CHANGES_MESSAGE,
  SELF_CHANGE_FORBIDDEN_MESSAGE,
  UpdateUserCommand,
  UpdateUserUseCase,
} from './update-user.use-case';

const actor: AuthUser = {
  id: 1,
  fullName: 'Super Admin SA01',
  role: Role.SUPERADMIN,
  divisi: null,
  isActive: true,
  passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
};

const target: AuthUser = {
  id: 7,
  fullName: 'Budi Santoso LG01',
  role: Role.MANAGER_MAIN_OFFICE,
  divisi: Divisi.LEGAL,
  isActive: true,
  passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('UpdateUserUseCase', () => {
  let useCase: UpdateUserUseCase;
  const users = { findAuthUserById: jest.fn() };
  const userAdmin = { update: jest.fn() };

  const update = (changes: Partial<UpdateUserCommand>, userId = 7) =>
    useCase.execute({ actor, userId, ...changes });

  beforeEach(async () => {
    jest.resetAllMocks();
    users.findAuthUserById.mockResolvedValue(target);
    userAdmin.update.mockImplementation((_id, changes) =>
      Promise.resolve({ ...target, ...changes }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        UpdateUserUseCase,
        { provide: UserRepository, useValue: users },
        { provide: UserAdminRepository, useValue: userAdmin },
      ],
    }).compile();

    useCase = moduleRef.get(UpdateUserUseCase);
  });

  it('rejects a request that changes nothing without touching storage', async () => {
    await expect(update({})).rejects.toThrow(
      new BadRequestException(NO_CHANGES_MESSAGE),
    );
    expect(users.findAuthUserById).not.toHaveBeenCalled();
    expect(userAdmin.update).not.toHaveBeenCalled();
  });

  it.each([
    ['a role change', { role: Role.TEAM_MAIN_OFFICE }],
    ['a deactivation', { isActive: false }],
    ['an activation', { isActive: true }],
  ])('forbids %s on the actor’s own account', async (_label, changes) => {
    await expect(update(changes, actor.id)).rejects.toThrow(
      new ForbiddenException(SELF_CHANGE_FORBIDDEN_MESSAGE),
    );
    expect(users.findAuthUserById).not.toHaveBeenCalled();
    expect(userAdmin.update).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown account', async () => {
    users.findAuthUserById.mockResolvedValue(null);

    await expect(update({ isActive: false }, 999)).rejects.toThrow(
      new NotFoundException(USER_NOT_FOUND_MESSAGE),
    );
    expect(userAdmin.update).not.toHaveBeenCalled();
  });

  it.each([
    ['SUPERADMIN while keeping the current divisi', { role: Role.SUPERADMIN }],
    [
      'a finance role while keeping a non-finance divisi',
      { role: Role.FINANCE_MAIN_OFFICE },
    ],
    ['FINANCE divisi for a general manager', { divisi: Divisi.FINANCE }],
    ['no divisi for a general manager', { divisi: null }],
    [
      'SUPERADMIN together with a divisi',
      { role: Role.SUPERADMIN, divisi: Divisi.IT },
    ],
  ])('rejects %s', async (_label, changes) => {
    await expect(update(changes)).rejects.toThrow(
      new BadRequestException(ROLE_DIVISI_INVALID_MESSAGE),
    );
    expect(userAdmin.update).not.toHaveBeenCalled();
  });

  it.each([
    [
      'SUPERADMIN with the divisi cleared',
      { role: Role.SUPERADMIN, divisi: null },
    ],
    [
      'a finance manager inside FINANCE',
      { role: Role.FINANCE_MANAGER_MAIN_OFFICE, divisi: Divisi.FINANCE },
    ],
    ['another general divisi', { divisi: Divisi.TAX }],
    ['a switch to the team role', { role: Role.TEAM_MAIN_OFFICE }],
    ['a deactivation alone', { isActive: false }],
  ])('accepts %s', async (_label, changes) => {
    await expect(update(changes)).resolves.toMatchObject(changes);
    expect(userAdmin.update).toHaveBeenCalledWith(
      7,
      expect.objectContaining(changes),
    );
  });

  it('sends only the fields that were provided', async () => {
    await update({ isActive: false });

    const [id, changes] = userAdmin.update.mock.calls[0];
    expect(id).toBe(7);
    expect(changes.isActive).toBe(false);
    expect(changes.role).toBeUndefined();
    expect(changes.divisi).toBeUndefined();
  });

  it('still rejects giving SUPERADMIN a divisi on the actor’s own account', async () => {
    users.findAuthUserById.mockResolvedValue(actor);

    await expect(update({ divisi: Divisi.IT }, actor.id)).rejects.toThrow(
      new BadRequestException(ROLE_DIVISI_INVALID_MESSAGE),
    );
  });
});

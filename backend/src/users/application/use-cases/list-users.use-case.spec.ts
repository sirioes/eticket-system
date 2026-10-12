import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';
import { UserAdminRepository } from '../ports/user-admin.repository';
import { ListUsersUseCase } from './list-users.use-case';

describe('ListUsersUseCase', () => {
  it('returns every user from the repository', async () => {
    const all = [
      {
        id: 1,
        fullName: 'Rina Wulandari TX01',
        role: Role.TEAM_MAIN_OFFICE,
        divisi: Divisi.TAX,
        isActive: true,
        passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ];
    const userAdmin = { findAll: jest.fn().mockResolvedValue(all) };
    const useCase = new ListUsersUseCase(
      userAdmin as unknown as UserAdminRepository,
    );

    await expect(useCase.execute()).resolves.toBe(all);
  });
});

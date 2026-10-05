import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';
import { toAuthUserResponse } from './auth-user.response';

describe('toAuthUserResponse', () => {
  it('exposes only id, fullName, role and divisi', () => {
    const response = toAuthUserResponse({
      id: 7,
      fullName: 'Budi Santoso',
      role: Role.MANAGER_MAIN_OFFICE,
      divisi: Divisi.LEGAL,
      isActive: true,
      passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
    });

    expect(response).toEqual({
      id: 7,
      fullName: 'Budi Santoso',
      role: Role.MANAGER_MAIN_OFFICE,
      divisi: Divisi.LEGAL,
    });
  });
});
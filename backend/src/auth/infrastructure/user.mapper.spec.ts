import { toAuthUser, toUserCredentials, UserCredentialsRow } from './user.mapper';

const baseRow: UserCredentialsRow = {
  id: 1,
  fullName: 'Budi Santoso',
  role: 'MANAGER_MAIN_OFFICE',
  divisi: 'LEGAL',
  isActive: true,
  passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
  password: '$2b$10$hashhashhashhashhashhu',
};

describe('user.mapper', () => {
  describe('toAuthUser', () => {
    it('maps a valid row to AuthUser', () => {
      expect(toAuthUser(baseRow)).toEqual({
        id: 1,
        fullName: 'Budi Santoso',
        role: 'MANAGER_MAIN_OFFICE',
        divisi: 'LEGAL',
        isActive: true,
        passwordChangedAt: baseRow.passwordChangedAt,
      });
    });

    it('never leaks the password hash, even when the row contains it', () => {
      const user = toAuthUser(baseRow);
      expect(user).not.toHaveProperty('password');
      expect(user).not.toHaveProperty('passwordHash');
    });

    it('accepts null divisi (SUPERADMIN)', () => {
      const user = toAuthUser({ ...baseRow, role: 'SUPERADMIN', divisi: null });
      expect(user.divisi).toBeNull();
    });

    it('throws on unknown role instead of passing it through', () => {
      expect(() => toAuthUser({ ...baseRow, role: 'HACKER' })).toThrow(/Unknown role/);
    });

    it('throws on unknown divisi instead of passing it through', () => {
      expect(() => toAuthUser({ ...baseRow, divisi: 'MARS' })).toThrow(/Unknown divisi/);
    });
  });

  describe('toUserCredentials', () => {
    it('exposes the hash only as passwordHash', () => {
      const creds = toUserCredentials(baseRow);
      expect(creds.passwordHash).toBe(baseRow.password);
      expect(creds).not.toHaveProperty('password');
    });
  });
});
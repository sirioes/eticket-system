import * as bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS, BcryptPasswordHasher } from './bcrypt-password-hasher';

jest.mock('bcrypt', () => {
  const actual = jest.requireActual<typeof import('bcrypt')>('bcrypt');
  return { ...actual, compare: jest.fn(actual.compare) };
});

describe('BcryptPasswordHasher', () => {
  const hasher = new BcryptPasswordHasher();
  let hash: string;

  beforeAll(async () => {
    hash = await bcrypt.hash('rahasia123', BCRYPT_SALT_ROUNDS);
  });

  beforeEach(() => {
    jest.mocked(bcrypt.compare).mockClear();
  });

  it('returns true for the correct password', async () => {
    await expect(hasher.verify('rahasia123', hash)).resolves.toBe(true);
  });

  it('returns false for a wrong password', async () => {
    await expect(hasher.verify('salah123', hash)).resolves.toBe(false);
  });

  it('still runs bcrypt against a dummy hash when there is no stored hash', async () => {
    await expect(hasher.verify('apa-saja', null)).resolves.toBe(false);
    expect(bcrypt.compare).toHaveBeenCalledTimes(1);
    expect(jest.mocked(bcrypt.compare).mock.calls[0][1]).toMatch(/^\$2[aby]\$10\$/);
  });
});
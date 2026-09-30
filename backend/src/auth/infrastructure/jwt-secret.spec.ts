import { getJwtSecret, MIN_JWT_SECRET_LENGTH } from './jwt-secret';

const configWith = (value: string | undefined) => ({ get: jest.fn().mockReturnValue(value) });

describe('getJwtSecret', () => {
  it('returns the secret when it is long enough', () => {
    const secret = 'x'.repeat(MIN_JWT_SECRET_LENGTH);
    expect(getJwtSecret(configWith(secret))).toBe(secret);
  });

  it('throws when the secret is missing', () => {
    expect(() => getJwtSecret(configWith(undefined))).toThrow(/JWT_SECRET/);
  });

  it('throws when the secret is too short', () => {
    expect(() => getJwtSecret(configWith('x'.repeat(MIN_JWT_SECRET_LENGTH - 1)))).toThrow(/JWT_SECRET/);
  });
});
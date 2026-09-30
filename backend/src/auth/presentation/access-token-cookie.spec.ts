import { accessTokenCookieOptions } from './access-token-cookie';

const configWith = (value: string | undefined) => ({ get: jest.fn().mockReturnValue(value) });

describe('accessTokenCookieOptions', () => {
  it('builds an httpOnly, lax, root-path session cookie without maxAge', () => {
    const options = accessTokenCookieOptions(configWith('true'));

    expect(options).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
    expect(options).not.toHaveProperty('maxAge');
    expect(options).not.toHaveProperty('expires');
  });

  it('is secure by default when COOKIE_SECURE is not set', () => {
    expect(accessTokenCookieOptions(configWith(undefined)).secure).toBe(true);
  });

  it('is only insecure when COOKIE_SECURE is exactly "false"', () => {
    expect(accessTokenCookieOptions(configWith('false')).secure).toBe(false);
    expect(accessTokenCookieOptions(configWith('FALSE')).secure).toBe(true);
    expect(accessTokenCookieOptions(configWith('0')).secure).toBe(true);
  });
});
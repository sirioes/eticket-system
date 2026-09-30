import { ACCESS_TOKEN_COOKIE } from '../auth.constants';
import { extractAccessTokenFromCookie } from './jwt.strategy';

describe('extractAccessTokenFromCookie', () => {
  it('returns the token from the access token cookie', () => {
    expect(extractAccessTokenFromCookie({ cookies: { [ACCESS_TOKEN_COOKIE]: 'abc.def.ghi' } })).toBe('abc.def.ghi');
  });

  it.each([
    ['no request', undefined],
    ['no cookies object', {}],
    ['a missing cookie', { cookies: { other: 'value' } }],
    ['an empty cookie', { cookies: { [ACCESS_TOKEN_COOKIE]: '' } }],
    ['a non-string cookie', { cookies: { [ACCESS_TOKEN_COOKIE]: ['abc'] } }],
  ])('returns null for %s', (_label, request) => {
    expect(extractAccessTokenFromCookie(request)).toBeNull();
  });
});
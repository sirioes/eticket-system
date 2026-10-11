import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CROSS_SITE_MESSAGE } from './fetch-metadata.guard';
import { SameOriginGuard } from './same-origin.guard';

function ctx(method: string, headers: Record<string, string | string[]> = {}) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ method, headers }) }),
  } as unknown as ExecutionContext;
}

describe('SameOriginGuard', () => {
  const guard = new SameOriginGuard();

  it.each(['same-origin', 'none'])('allows GET with Sec-Fetch-Site %s', (site) => {
    expect(guard.canActivate(ctx('GET', { 'sec-fetch-site': site }))).toBe(
      true,
    );
  });

  it('allows GET without the header (non-browser client)', () => {
    expect(guard.canActivate(ctx('GET'))).toBe(true);
  });

  it.each(['cross-site', 'same-site', '', 'bogus'])(
    'rejects GET with Sec-Fetch-Site %p',
    (site) => {
      expect(() =>
        guard.canActivate(ctx('GET', { 'sec-fetch-site': site })),
      ).toThrow(new ForbiddenException(CROSS_SITE_MESSAGE));
    },
  );

  it('rejects a duplicated header', () => {
    expect(() =>
      guard.canActivate(
        ctx('GET', { 'sec-fetch-site': ['same-origin', 'cross-site'] }),
      ),
    ).toThrow(ForbiddenException);
  });
});

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CROSS_SITE_MESSAGE, FetchMetadataGuard } from './fetch-metadata.guard';

function ctx(method: string, headers: Record<string, string | string[]> = {}) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ method, headers }) }),
  } as unknown as ExecutionContext;
}

describe('FetchMetadataGuard', () => {
  const guard = new FetchMetadataGuard();

  it.each(['same-origin', 'none'])(
    'allows POST with Sec-Fetch-Site %s',
    (site) => {
      expect(guard.canActivate(ctx('POST', { 'sec-fetch-site': site }))).toBe(
        true,
      );
    },
  );

  it('allows POST without the header (non-browser client)', () => {
    expect(guard.canActivate(ctx('POST'))).toBe(true);
  });

  it.each(['cross-site', 'same-site', '', 'bogus'])(
    'rejects POST with Sec-Fetch-Site %p',
    (site) => {
      expect(() =>
        guard.canActivate(ctx('POST', { 'sec-fetch-site': site })),
      ).toThrow(new ForbiddenException(CROSS_SITE_MESSAGE));
    },
  );

  it.each(['PATCH', 'PUT', 'DELETE', 'post'])(
    'rejects cross-site %s',
    (method) => {
      expect(() =>
        guard.canActivate(ctx(method, { 'sec-fetch-site': 'cross-site' })),
      ).toThrow(ForbiddenException);
    },
  );

  it.each(['GET', 'HEAD', 'OPTIONS'])(
    'does not block safe method %s',
    (method) => {
      expect(
        guard.canActivate(ctx(method, { 'sec-fetch-site': 'cross-site' })),
      ).toBe(true);
    },
  );
});

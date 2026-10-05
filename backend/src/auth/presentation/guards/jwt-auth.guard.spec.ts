import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';
import { ValidateSessionUseCase } from '../../application/use-cases/validate-session.use-case';
import { ACCESS_TOKEN_COOKIE, INVALID_SESSION_MESSAGE } from '../../auth.constants';
import { AuthUser } from '../../domain/auth-user';
import { JwtStrategy } from '../../infrastructure/jwt.strategy';
import { Public } from '../decorators/public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

const SECRET = 'test-secret-that-is-at-least-32-characters';

const user: AuthUser = {
  id: 7,
  fullName: 'Budi Santoso',
  role: Role.MANAGER_MAIN_OFFICE,
  divisi: Divisi.LEGAL,
  isActive: true,
  passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
};

class TestController {
  protected() {}

  @Public()
  open() {}
}

interface FakeRequest {
  cookies?: Record<string, unknown>;
  headers: Record<string, string>;
  user?: unknown;
}

function contextFor(request: FakeRequest, handler: keyof TestController = 'protected'): ExecutionContext {
  return {
    getType: () => 'http',
    getClass: () => TestController,
    getHandler: () => TestController.prototype[handler],
    getArgs: () => [request, {}],
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => undefined,
    }),
  } as unknown as ExecutionContext;
}

function requestWithCookie(token: string): FakeRequest {
  return { cookies: { [ACCESS_TOKEN_COOKIE]: token }, headers: {} };
}

describe('JwtAuthGuard with JwtStrategy', () => {
  let guard: JwtAuthGuard;
  const signer = new JwtService({ secret: SECRET });
  const validateSession = { execute: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      providers: [
        JwtAuthGuard,
        JwtStrategy,
        Reflector,
        { provide: ConfigService, useValue: { get: () => SECRET } },
        { provide: ValidateSessionUseCase, useValue: validateSession },
      ],
    }).compile();

    guard = moduleRef.get(JwtAuthGuard);
  });

  it('accepts a valid token from the cookie and attaches the user', async () => {
    validateSession.execute.mockResolvedValue(user);
    const request = requestWithCookie(signer.sign({ sub: 7 }));

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual(user);
    expect(validateSession.execute).toHaveBeenCalledWith(expect.objectContaining({ sub: 7 }));
  });

  it('rejects a request without the cookie', async () => {
    await expect(guard.canActivate(contextFor({ headers: {} }))).rejects.toThrow(
      new UnauthorizedException(INVALID_SESSION_MESSAGE),
    );
    expect(validateSession.execute).not.toHaveBeenCalled();
  });

  it('ignores a token sent in the Authorization header', async () => {
    const request: FakeRequest = { headers: { authorization: `Bearer ${signer.sign({ sub: 7 })}` } };

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(UnauthorizedException);
    expect(validateSession.execute).not.toHaveBeenCalled();
  });

  it('rejects a token signed with another secret', async () => {
    const forged = new JwtService({ secret: 'another-secret-that-is-also-32-chars-long' }).sign({ sub: 7 });

    await expect(guard.canActivate(contextFor(requestWithCookie(forged)))).rejects.toThrow(UnauthorizedException);
    expect(validateSession.execute).not.toHaveBeenCalled();
  });

  it('rejects an expired token', async () => {
    const expired = signer.sign({ sub: 7, exp: Math.floor(Date.now() / 1000) - 10 });

    await expect(guard.canActivate(contextFor(requestWithCookie(expired)))).rejects.toThrow(UnauthorizedException);
    expect(validateSession.execute).not.toHaveBeenCalled();
  });

  it('rejects an unsigned token using alg none', async () => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: 7, iat: 1 })}.`;

    await expect(guard.canActivate(contextFor(requestWithCookie(unsigned)))).rejects.toThrow(UnauthorizedException);
    expect(validateSession.execute).not.toHaveBeenCalled();
  });

  it('keeps the session error when the user is no longer valid', async () => {
    validateSession.execute.mockRejectedValue(new UnauthorizedException(INVALID_SESSION_MESSAGE));

    await expect(guard.canActivate(contextFor(requestWithCookie(signer.sign({ sub: 7 }))))).rejects.toThrow(
      new UnauthorizedException(INVALID_SESSION_MESSAGE),
    );
  });

  it('does not turn an infrastructure failure into a 401', async () => {
    validateSession.execute.mockRejectedValue(new Error('database unavailable'));

    const attempt = guard.canActivate(contextFor(requestWithCookie(signer.sign({ sub: 7 }))));

    await expect(attempt).rejects.toThrow('database unavailable');
    await expect(attempt).rejects.not.toBeInstanceOf(UnauthorizedException);
  });

  it('lets a @Public() handler through without a token', () => {
    expect(guard.canActivate(contextFor({ headers: {} }, 'open'))).toBe(true);
    expect(validateSession.execute).not.toHaveBeenCalled();
  });
});
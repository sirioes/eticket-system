import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import {
  ValidateSessionUseCase,
  VerifiedTokenPayload,
} from '../application/use-cases/validate-session.use-case';
import { ACCESS_TOKEN_COOKIE } from '../auth.constants';
import { AuthUser } from '../domain/auth-user';
import { getJwtSecret } from './jwt-secret';

interface RequestWithCookies {
  cookies?: Record<string, unknown>;
}

export function extractAccessTokenFromCookie(request: RequestWithCookies | undefined): string | null {
  const token = request?.cookies?.[ACCESS_TOKEN_COOKIE];
  return typeof token === 'string' && token.length > 0 ? token : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly validateSession: ValidateSessionUseCase,
  ) {
    super({
      jwtFromRequest: extractAccessTokenFromCookie,
      secretOrKey: getJwtSecret(config),
      algorithms: ['HS256'],
      ignoreExpiration: false,
    });
  }

  validate(payload: VerifiedTokenPayload): Promise<AuthUser> {
    return this.validateSession.execute(payload);
  }
}
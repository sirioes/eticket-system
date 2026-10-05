import { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';

export function accessTokenCookieOptions(config: Pick<ConfigService, 'get'>): CookieOptions {
  return {
    httpOnly: true,
    secure: config.get<string>('COOKIE_SECURE') !== 'false',
    sameSite: 'lax',
    path: '/',
  };
}
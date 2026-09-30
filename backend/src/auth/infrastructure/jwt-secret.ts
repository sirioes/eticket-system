import { ConfigService } from '@nestjs/config';

export const MIN_JWT_SECRET_LENGTH = 32;

export function getJwtSecret(config: Pick<ConfigService, 'get'>): string {
  const secret = config.get<string>('JWT_SECRET');

  if (!secret || secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be set and at least ${MIN_JWT_SECRET_LENGTH} characters long`);
  }

  return secret;
}
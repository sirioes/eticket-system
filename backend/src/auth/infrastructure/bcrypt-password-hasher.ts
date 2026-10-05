import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { PasswordHasher } from '../application/ports/password-hasher';

export const BCRYPT_SALT_ROUNDS = 10;

const BCRYPT_MAX_PASSWORD_BYTES = 72;

const DUMMY_HASH = bcrypt.hashSync(randomUUID(), BCRYPT_SALT_ROUNDS);

@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  async hash(plainPassword: string): Promise<string> {
    if (Buffer.byteLength(plainPassword, 'utf8') > BCRYPT_MAX_PASSWORD_BYTES) {
      throw new RangeError('Password exceeds bcrypt input limit');
    }
    return bcrypt.hash(plainPassword, BCRYPT_SALT_ROUNDS);
  }

  async verify(plainPassword: string, passwordHash: string | null): Promise<boolean> {
    const matches = await bcrypt.compare(plainPassword, passwordHash ?? DUMMY_HASH);
    return passwordHash !== null && matches;
  }
}
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { PasswordHasher } from '../application/ports/password-hasher';

export const BCRYPT_SALT_ROUNDS = 10;

const DUMMY_HASH = bcrypt.hashSync(randomUUID(), BCRYPT_SALT_ROUNDS);

@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  async verify(plainPassword: string, passwordHash: string | null): Promise<boolean> {
    const matches = await bcrypt.compare(plainPassword, passwordHash ?? DUMMY_HASH);
    return passwordHash !== null && matches;
  }
}
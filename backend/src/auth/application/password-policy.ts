import { BadRequestException } from '@nestjs/common';
import { hasLoneSurrogate } from '../../common/utils/text-safety';

const MIN_PASSWORD_LENGTH = 8;

const MAX_PASSWORD_BYTES = 72;

export const PASSWORD_TOO_SHORT_MESSAGE = `Password baru minimal ${MIN_PASSWORD_LENGTH} karakter`;

export const PASSWORD_TOO_LONG_MESSAGE = 'Password baru terlalu panjang';

export const PASSWORD_INVALID_CHARACTER_MESSAGE =
  'Password baru mengandung karakter tidak valid';

export function assertValidNewPassword(password: string): void {
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    throw new BadRequestException(PASSWORD_TOO_LONG_MESSAGE);
  }

  if (hasLoneSurrogate(password)) {
    throw new BadRequestException(PASSWORD_INVALID_CHARACTER_MESSAGE);
  }

  if ([...password].length < MIN_PASSWORD_LENGTH) {
    throw new BadRequestException(PASSWORD_TOO_SHORT_MESSAGE);
  }
}

export function currentPasswordChangeTime(): Date {
  return new Date(Math.floor(Date.now() / 1000) * 1000);
}

import { BadRequestException } from '@nestjs/common';
import {
  assertValidNewPassword,
  currentPasswordChangeTime,
  PASSWORD_INVALID_CHARACTER_MESSAGE,
  PASSWORD_TOO_LONG_MESSAGE,
  PASSWORD_TOO_SHORT_MESSAGE,
} from './password-policy';

describe('assertValidNewPassword', () => {
  it.each([
    ['longer than 72 bytes', 'a'.repeat(73), PASSWORD_TOO_LONG_MESSAGE],
    [
      'a lone surrogate',
      `abcdefg${'\uD800'}`,
      PASSWORD_INVALID_CHARACTER_MESSAGE,
    ],
    ['shorter than 8 characters', 'pendek', PASSWORD_TOO_SHORT_MESSAGE],
    [
      '4 emoji counted as 4 characters',
      '😀'.repeat(4),
      PASSWORD_TOO_SHORT_MESSAGE,
    ],
    ['an empty string', '', PASSWORD_TOO_SHORT_MESSAGE],
  ])('rejects a password %s', (_label, password, message) => {
    expect(() => assertValidNewPassword(password)).toThrow(
      new BadRequestException(message),
    );
  });

  it.each([
    ['exactly 8 characters', '12345678'],
    ['exactly 72 bytes', 'a'.repeat(72)],
    ['72 bytes made of emoji', '😀'.repeat(18)],
  ])('accepts a password with %s', (_label, password) => {
    expect(() => assertValidNewPassword(password)).not.toThrow();
  });
});

describe('currentPasswordChangeTime', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('truncates the current time to whole seconds', () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(Date.parse('2026-10-12T03:00:00.999Z'));

    expect(currentPasswordChangeTime()).toEqual(
      new Date('2026-10-12T03:00:00.000Z'),
    );
  });
});

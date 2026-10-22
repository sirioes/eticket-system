import {
  isReasonLengthValid,
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
  requiresReason,
} from './ticket-message-rules';

describe('requiresReason', () => {
  it.each([
    ['TERIMA', true],
    ['TOLAK', true],
    ['PROSES', false],
    ['SELESAI', false],
  ] as const)('%s -> %s', (action, expected) => {
    expect(requiresReason(action)).toBe(expected);
  });
});

describe('isReasonLengthValid', () => {
  it('menerima batas bawah dan batas atas', () => {
    expect(isReasonLengthValid('a'.repeat(REASON_MIN_LENGTH))).toBe(true);
    expect(isReasonLengthValid('a'.repeat(REASON_MAX_LENGTH))).toBe(true);
  });

  it('menolak di luar batas', () => {
    expect(isReasonLengthValid('a'.repeat(REASON_MIN_LENGTH - 1))).toBe(false);
    expect(isReasonLengthValid('a'.repeat(REASON_MAX_LENGTH + 1))).toBe(false);
    expect(isReasonLengthValid('')).toBe(false);
  });

  it('menghitung karakter, bukan unit UTF-16', () => {
    expect(isReasonLengthValid('😀'.repeat(REASON_MIN_LENGTH))).toBe(true);
    expect(isReasonLengthValid('😀'.repeat(REASON_MAX_LENGTH))).toBe(true);
    expect(isReasonLengthValid('😀'.repeat(REASON_MAX_LENGTH + 1))).toBe(false);
  });
});

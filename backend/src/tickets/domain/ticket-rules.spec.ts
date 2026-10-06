import { Divisi } from '../../common/enums/divisi.enum';
import { canSendTicket, isDescriptionLengthValid } from './ticket-rules';

describe('canSendTicket', () => {
  it('menolak divisi tujuan yang sama dengan divisi pengirim', () => {
    expect(canSendTicket(Divisi.IT, Divisi.IT)).toBe(false);
  });

  it('mengizinkan divisi tujuan yang berbeda', () => {
    expect(canSendTicket(Divisi.IT, Divisi.FINANCE)).toBe(true);
  });
});

describe('isDescriptionLengthValid', () => {
  it('menolak 3 dan 3000 karakter', () => {
    expect(isDescriptionLengthValid('abc')).toBe(false);
    expect(isDescriptionLengthValid('a'.repeat(3000))).toBe(false);
  });

  it('menerima batas bawah 10 dan batas atas 2000', () => {
    expect(isDescriptionLengthValid('a'.repeat(10))).toBe(true);
    expect(isDescriptionLengthValid('a'.repeat(2000))).toBe(true);
  });

  it('menghitung emoji sebagai satu karakter', () => {
    expect(isDescriptionLengthValid('🙏'.repeat(2000))).toBe(true);
  });
});
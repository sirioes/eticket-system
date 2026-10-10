import { Divisi } from '../../common/enums/divisi.enum';
import {
  canSendTicket,
  DESCRIPTION_PREVIEW_LENGTH,
  isDescriptionLengthValid,
  toDescriptionPreview,
} from './ticket-rules';

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

describe('toDescriptionPreview', () => {
  it('mengembalikan deskripsi pendek apa adanya', () => {
    expect(toDescriptionPreview('Printer lantai 2 rusak')).toBe(
      'Printer lantai 2 rusak',
    );
  });

  it('meratakan baris baru dan spasi berulang menjadi satu spasi', () => {
    expect(
      toDescriptionPreview('Baris satu\n\n  baris   dua\tbaris tiga'),
    ).toBe('Baris satu baris dua baris tiga');
  });

  it('menerima tepat 120 karakter tanpa pemotongan', () => {
    const exact = 'a'.repeat(DESCRIPTION_PREVIEW_LENGTH);

    expect(toDescriptionPreview(exact)).toBe(exact);
  });

  it('memotong di 120 karakter dan menambah elipsis', () => {
    const preview = toDescriptionPreview('a'.repeat(121));

    expect(preview).toBe(`${'a'.repeat(DESCRIPTION_PREVIEW_LENGTH)}…`);
  });

  it('tidak menyisakan spasi sebelum elipsis', () => {
    const text = `${'a'.repeat(119)} ${'b'.repeat(20)}`;

    expect(toDescriptionPreview(text)).toBe(`${'a'.repeat(119)}…`);
  });

  it('memotong per karakter sehingga emoji tidak terbelah', () => {
    const preview = toDescriptionPreview('🙏'.repeat(130));

    expect(preview).toBe(`${'🙏'.repeat(DESCRIPTION_PREVIEW_LENGTH)}…`);
  });
});

import {
  hasLoneSurrogate,
  hasUnsafeInvisibleCharacter,
  normalizeMultilineText,
} from './text-safety';

describe('hasLoneSurrogate', () => {
  it('menerima teks biasa dan emoji utuh', () => {
    expect(hasLoneSurrogate('Printer lantai 2 rusak 🙏')).toBe(false);
  });

  it('mendeteksi surrogate yang berdiri sendiri', () => {
    expect(hasLoneSurrogate('abc\uD83D')).toBe(true);
    expect(hasLoneSurrogate('\uDE4Fabc')).toBe(true);
  });
});

describe('hasUnsafeInvisibleCharacter', () => {
  it('menerima teks biasa, emoji, baris baru dan tab', () => {
    expect(hasUnsafeInvisibleCharacter('Printer lantai 2 rusak 🙏')).toBe(false);
    expect(hasUnsafeInvisibleCharacter('Baris satu\nBaris dua\tberjarak')).toBe(false);
  });

  it.each([
    ['NUL', '\u0000'],
    ['escape', '\u001B'],
    ['delete', '\u007F'],
    ['carriage return', '\r'],
    ['zero width space', '\u200B'],
    ['zero width non joiner', '\u200C'],
    ['left to right mark', '\u200E'],
    ['right to left override', '\u202E'],
    ['mongolian vowel separator', '\u180E'],
  ])('menolak %s', (_label, char) => {
    expect(hasUnsafeInvisibleCharacter(`Printer rusak${char} lantai 2`)).toBe(true);
  });
});

describe('normalizeMultilineText', () => {
  it('menyeragamkan akhir baris Windows menjadi LF', () => {
    expect(normalizeMultilineText('baris satu\r\nbaris dua\rbaris tiga')).toBe(
      'baris satu\nbaris dua\nbaris tiga',
    );
  });

  it('memangkas spasi dan baris kosong di awal dan akhir', () => {
    expect(normalizeMultilineText('  \n Printer rusak \n\n ')).toBe('Printer rusak');
  });

  it('mempertahankan baris baru di tengah teks', () => {
    expect(normalizeMultilineText('Printer rusak\nTolong dicek')).toBe('Printer rusak\nTolong dicek');
  });
});
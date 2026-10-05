import { normalizeFullName } from './normalize-full-name';

describe('normalizeFullName', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeFullName('  Budi Santoso  ')).toBe('Budi Santoso');
  });

  it('collapses multiple inner spaces into one', () => {
    expect(normalizeFullName('Budi    Santoso')).toBe('Budi Santoso');
  });

  it('collapses tabs and newlines as whitespace', () => {
    expect(normalizeFullName('Budi\t\nSantoso')).toBe('Budi Santoso');
  });

  it('preserves letter casing (case-insensitivity is handled by DB collation)', () => {
    expect(normalizeFullName('budi SANTOSO')).toBe('budi SANTOSO');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeFullName('   ')).toBe('');
  });
});
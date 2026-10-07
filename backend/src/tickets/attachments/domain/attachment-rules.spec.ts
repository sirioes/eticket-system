import {
  canonicalMimeType,
  canReceiveAttachments,
  extensionMatchesMimeType,
  hasAllowedExtension,
  isAllowedMimeType,
  sanitizeDisplayFileName,
} from './attachment-rules';

describe('attachment rules', () => {
  describe('isAllowedMimeType', () => {
    it.each(['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])(
      'allows %s',
      (mime) => expect(isAllowedMimeType(mime)).toBe(true),
    );

    it.each([
      'image/svg+xml',
      'image/gif',
      'text/html',
      'application/x-msdownload',
      'IMAGE/PNG',
      '',
      '__proto__',
      'constructor',
      'toString',
    ])('rejects %p', (mime) => expect(isAllowedMimeType(mime)).toBe(false));
  });

  describe('hasAllowedExtension', () => {
    it.each([
      'a.png',
      'A.PNG',
      'a.jpg',
      'a.jpeg',
      'a.webp',
      'a.pdf',
      'a.b.pdf',
    ])('accepts %p', (name) => expect(hasAllowedExtension(name)).toBe(true));

    it.each(['a.exe', 'a.svg', 'a.png.exe', 'a', 'a.', '', '.png.html'])(
      'rejects %p',
      (name) => expect(hasAllowedExtension(name)).toBe(false),
    );
  });

  describe('extensionMatchesMimeType', () => {
    it.each([
      ['foto.png', 'image/png'],
      ['FOTO.PNG', 'image/png'],
      ['foto.jpg', 'image/jpeg'],
      ['foto.JPEG', 'image/jpeg'],
      ['foto.webp', 'image/webp'],
      ['nota.pdf', 'application/pdf'],
      ['a.b.c.pdf', 'application/pdf'],
    ] as const)('accepts %s as %s', (name, mime) =>
      expect(extensionMatchesMimeType(name, mime)).toBe(true),
    );

    it.each([
      ['malware.exe', 'image/png'],
      ['foto.png', 'application/pdf'],
      ['foto.png.exe', 'image/png'],
      ['foto', 'image/png'],
      ['foto.', 'image/png'],
      ['', 'image/png'],
    ] as const)('rejects %p as %s', (name, mime) =>
      expect(extensionMatchesMimeType(name, mime)).toBe(false),
    );
  });

  describe('canonicalMimeType', () => {
    it('treats an animated PNG as a PNG', () => {
      expect(canonicalMimeType('image/apng')).toBe('image/png');
    });

    it.each([
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/pdf',
      'image/gif',
      'application/x-msdownload',
      '__proto__',
      'constructor',
    ])('leaves %s unchanged', (mime) => {
      expect(canonicalMimeType(mime)).toBe(mime);
    });
  });

  describe('canReceiveAttachments', () => {
    it('is true only while waiting for the origin manager', () => {
      expect(canReceiveAttachments('MENUNGGU_MANAGER_ASAL')).toBe(true);
      for (const stage of [
        'MENUNGGU_MANAGER_TUJUAN',
        'MENUNGGU_STAF_TUJUAN',
        'DIPROSES',
        'SELESAI',
        'DITOLAK',
      ] as const) {
        expect(canReceiveAttachments(stage)).toBe(false);
      }
    });
  });

  describe('sanitizeDisplayFileName', () => {
    it('keeps a normal name', () => {
      expect(sanitizeDisplayFileName('Bukti transfer.pdf')).toBe(
        'Bukti transfer.pdf',
      );
    });

    it.each([
      ['../../etc/passwd.png', 'passwd.png'],
      ['..\\..\\windows\\system32\\a.png', 'a.png'],
      ['/abs/path/file.pdf', 'file.pdf'],
      ['C:\\Users\\x\\scan.pdf', 'scan.pdf'],
    ])('drops directory parts of %p', (raw, expected) =>
      expect(sanitizeDisplayFileName(raw)).toBe(expected),
    );

    it('removes control, newline and NUL characters', () => {
      expect(sanitizeDisplayFileName('a\r\nSet-Cookie: x=1\u0000.png')).toBe(
        'aSet-Cookie: x=1.png',
      );
    });

    it('removes bidi override characters used for extension spoofing', () => {
      expect(sanitizeDisplayFileName('foto\u202Egnp.exe')).toBe('fotognp.exe');
    });

    it('removes lone surrogates', () => {
      expect(sanitizeDisplayFileName('a\uD800b.png')).toBe('ab.png');
    });

    it('strips leading dots so the name is never hidden or relative', () => {
      expect(sanitizeDisplayFileName('...hidden.png')).toBe('hidden.png');
    });

    it('drops dots and spaces together at the start', () => {
      expect(sanitizeDisplayFileName('. .pdf')).toBe('pdf');
      expect(sanitizeDisplayFileName(' . . a.pdf')).toBe('a.pdf');
    });

    it.each(['', '   ', '.', '..', '/', '\u0000\u202E'])(
      'falls back to a placeholder for %p',
      (raw) => expect(sanitizeDisplayFileName(raw)).toBe('lampiran'),
    );

    it('shortens a very long name but keeps the extension', () => {
      const result = sanitizeDisplayFileName(`${'a'.repeat(400)}.pdf`);
      expect(Array.from(result)).toHaveLength(150);
      expect(result.endsWith('.pdf')).toBe(true);
    });

    it('leaves no space before the extension when the cut lands on one', () => {
      const result = sanitizeDisplayFileName(
        `${'a'.repeat(145)} bbbbbbbbbb.pdf`,
      );
      expect(result).not.toMatch(/\s\.pdf$/);
      expect(result.endsWith('.pdf')).toBe(true);
      expect(Array.from(result).length).toBeLessThanOrEqual(150);
    });

    it('leaves no trailing space when a long name without extension is cut', () => {
      const result = sanitizeDisplayFileName(
        `${'a'.repeat(149)} ${'b'.repeat(50)}`,
      );
      expect(result).toBe('a'.repeat(149));
    });

    it('counts code points, so emoji are not split', () => {
      const result = sanitizeDisplayFileName(`${'😀'.repeat(300)}.png`);
      expect(Array.from(result)).toHaveLength(150);
      expect(result).not.toMatch(/\p{Cs}/u);
    });

    it('cuts a long name without a usable extension at the limit', () => {
      expect(Array.from(sanitizeDisplayFileName('b'.repeat(300)))).toHaveLength(
        150,
      );
    });
  });
});

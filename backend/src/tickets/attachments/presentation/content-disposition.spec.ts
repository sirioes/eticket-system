import { attachmentDisposition } from './content-disposition';

describe('attachmentDisposition', () => {
  it('always forces a download', () => {
    expect(attachmentDisposition('laporan.pdf')).toBe(
      `attachment; filename="laporan.pdf"; filename*=UTF-8''laporan.pdf`,
    );
  });

  it('keeps unicode in filename* and replaces it in the ascii fallback', () => {
    const header = attachmentDisposition('laporan é 日本.pdf');

    expect(header).toContain('filename="laporan _ __.pdf"');
    expect(header).toContain(
      "filename*=UTF-8''laporan%20%C3%A9%20%E6%97%A5%E6%9C%AC.pdf",
    );
  });

  it.each([
    ['quote', 'a"b.pdf'],
    ['backslash', 'a\\b.pdf'],
    ['CRLF injection', 'a.pdf\r\nSet-Cookie: x=1'],
    ['semicolon', 'a.pdf; filename=evil.html'],
  ])('cannot break out of the header with a %s', (_label, name) => {
    const header = attachmentDisposition(name);

    expect(header).not.toMatch(/[\r\n]/);
    expect(header.match(/"/g)).toHaveLength(2);
    expect(header.split(';')).toHaveLength(3);
  });

  it('encodes characters that RFC 5987 reserves', () => {
    expect(attachmentDisposition("a'b(c)*.png")).toContain(
      "filename*=UTF-8''a%27b%28c%29%2A.png",
    );
  });

  it('does not throw on a lone surrogate', () => {
    expect(() => attachmentDisposition('a\ud800.png')).not.toThrow();
  });
});

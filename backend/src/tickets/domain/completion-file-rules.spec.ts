import {
  completionExtensionMatchesMimeType,
  hasAllowedCompletionExtension,
  isAllowedCompletionMimeType,
  isCompletionFileSizeValid,
  MAX_COMPLETION_FILE_BYTES,
  MAX_COMPLETION_FILES,
} from './completion-file-rules';

const XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('batas dokumen penyelesaian', () => {
  it('memakai 5 file dan 10 MB per file', () => {
    expect(MAX_COMPLETION_FILES).toBe(5);
    expect(MAX_COMPLETION_FILE_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe('isCompletionFileSizeValid', () => {
  it('menerima 1 byte sampai tepat 10 MB', () => {
    expect(isCompletionFileSizeValid(1)).toBe(true);
    expect(isCompletionFileSizeValid(MAX_COMPLETION_FILE_BYTES)).toBe(true);
  });

  it('menolak file kosong dan di atas 10 MB', () => {
    expect(isCompletionFileSizeValid(0)).toBe(false);
    expect(isCompletionFileSizeValid(MAX_COMPLETION_FILE_BYTES + 1)).toBe(
      false,
    );
  });
});

describe('isAllowedCompletionMimeType', () => {
  it.each([
    'application/pdf',
    XLSX,
    DOCX,
    'image/png',
    'image/jpeg',
    'image/webp',
  ])('menerima %s', (mime) => {
    expect(isAllowedCompletionMimeType(mime)).toBe(true);
  });

  it.each([
    'application/zip',
    'application/xml',
    'application/x-cfb',
    'application/msword',
    'application/vnd.ms-excel',
    'image/svg+xml',
    'image/gif',
    'video/mp4',
    'constructor',
    '__proto__',
  ])('menolak %s', (mime) => {
    expect(isAllowedCompletionMimeType(mime)).toBe(false);
  });
});

describe('hasAllowedCompletionExtension', () => {
  it.each([
    'laporan.pdf',
    'LPJ.XLSX',
    'capex.docx',
    'foto.png',
    'foto.jpg',
    'foto.jpeg',
    'foto.webp',
  ])('menerima %s', (name) => {
    expect(hasAllowedCompletionExtension(name)).toBe(true);
  });

  it.each([
    'lama.xls',
    'lama.doc',
    'arsip.zip',
    'gambar.svg',
    'skrip.exe',
    'tanpa-ekstensi',
    'macro.xlsm',
  ])('menolak %s', (name) => {
    expect(hasAllowedCompletionExtension(name)).toBe(false);
  });
});

describe('completionExtensionMatchesMimeType', () => {
  it.each([
    ['a.pdf', 'application/pdf'],
    ['a.xlsx', XLSX],
    ['a.docx', DOCX],
    ['a.png', 'image/png'],
    ['a.JPG', 'image/jpeg'],
    ['a.jpeg', 'image/jpeg'],
    ['a.webp', 'image/webp'],
  ] as const)('mencocokkan %s dengan %s', (name, mime) => {
    expect(completionExtensionMatchesMimeType(name, mime)).toBe(true);
  });

  it.each([
    ['a.docx', XLSX],
    ['a.xlsx', DOCX],
    ['a.pdf', 'image/png'],
    ['a.png', 'application/pdf'],
    ['tanpa-ekstensi', 'application/pdf'],
  ] as const)('menolak %s sebagai %s', (name, mime) => {
    expect(completionExtensionMatchesMimeType(name, mime)).toBe(false);
  });
});

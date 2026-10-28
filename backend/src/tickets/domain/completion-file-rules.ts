export const MAX_COMPLETION_FILES = 5;
export const MAX_COMPLETION_FILE_BYTES = 10 * 1024 * 1024;

export const COMPLETION_FILE_SIZE_MESSAGE = 'Ukuran dokumen maksimum 10 MB';

export const UNSUPPORTED_COMPLETION_FILE_MESSAGE =
  'Tipe file tidak diizinkan (hanya PDF, Excel .xlsx, Word .docx, PNG, JPEG, atau WebP)';

const ALLOWED_TYPES = {
  'application/pdf': { extensions: ['pdf'] },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    extensions: ['xlsx'],
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    extensions: ['docx'],
  },
  'image/png': { extensions: ['png'] },
  'image/jpeg': { extensions: ['jpg', 'jpeg'] },
  'image/webp': { extensions: ['webp'] },
} as const;

export type CompletionMimeType = keyof typeof ALLOWED_TYPES;

export function isCompletionFileSizeValid(size: number): boolean {
  return size > 0 && size <= MAX_COMPLETION_FILE_BYTES;
}

export function isAllowedCompletionMimeType(
  value: string,
): value is CompletionMimeType {
  return Object.hasOwn(ALLOWED_TYPES, value);
}

function extensionOf(fileName: string): string | null {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? null : fileName.slice(dot + 1).toLowerCase();
}

export function hasAllowedCompletionExtension(fileName: string): boolean {
  const extension = extensionOf(fileName);
  if (extension === null) return false;
  return Object.values(ALLOWED_TYPES).some((type) =>
    (type.extensions as readonly string[]).includes(extension),
  );
}

export function completionExtensionMatchesMimeType(
  fileName: string,
  mimeType: CompletionMimeType,
): boolean {
  const extension = extensionOf(fileName);
  if (extension === null) return false;
  return (ALLOWED_TYPES[mimeType].extensions as readonly string[]).includes(
    extension,
  );
}

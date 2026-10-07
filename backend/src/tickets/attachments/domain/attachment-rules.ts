import { TicketStage } from '../../../generated/prisma/client';

export const MAX_ATTACHMENTS_PER_TICKET = 5;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export const UNSUPPORTED_FILE_TYPE_MESSAGE =
  'Tipe file tidak diizinkan (hanya PNG, JPEG, WebP, atau PDF)';

const ATTACHMENT_STAGE: TicketStage = 'MENUNGGU_MANAGER_ASAL';

const MAX_DISPLAY_NAME_LENGTH = 150;
const FALLBACK_DISPLAY_NAME = 'lampiran';

const UNSAFE_NAME_CHARACTER = /[\p{Cc}\p{Cf}\p{Cs}]/gu;

const ALLOWED_TYPES = {
  'image/png': { extensions: ['png'] },
  'image/jpeg': { extensions: ['jpg', 'jpeg'] },
  'image/webp': { extensions: ['webp'] },
  'application/pdf': { extensions: ['pdf'] },
} as const;

export type AllowedMimeType = keyof typeof ALLOWED_TYPES;

const DETECTED_TYPE_ALIASES: Readonly<Record<string, AllowedMimeType>> = {
  'image/apng': 'image/png',
};

export function canonicalMimeType(detected: string): string {
  return Object.hasOwn(DETECTED_TYPE_ALIASES, detected)
    ? DETECTED_TYPE_ALIASES[detected]
    : detected;
}

export function isAllowedMimeType(value: string): value is AllowedMimeType {
  return Object.hasOwn(ALLOWED_TYPES, value);
}

function extensionOf(fileName: string): string | null {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? null : fileName.slice(dot + 1).toLowerCase();
}

export function hasAllowedExtension(fileName: string): boolean {
  const extension = extensionOf(fileName);
  if (extension === null) return false;
  return Object.values(ALLOWED_TYPES).some((type) =>
    (type.extensions as readonly string[]).includes(extension),
  );
}

export function extensionMatchesMimeType(
  fileName: string,
  mimeType: AllowedMimeType,
): boolean {
  const extension = extensionOf(fileName);
  if (extension === null) return false;
  return (ALLOWED_TYPES[mimeType].extensions as readonly string[]).includes(
    extension,
  );
}

export function canReceiveAttachments(stage: TicketStage): boolean {
  return stage === ATTACHMENT_STAGE;
}

export function sanitizeDisplayFileName(raw: string): string {
  const baseName = raw.split(/[\\/]/).pop() ?? '';
  const cleaned = baseName
    .replace(UNSAFE_NAME_CHARACTER, '')
    .replace(/\s+/g, ' ')

    .replace(/^[.\s]+/, '');
  if (cleaned === '') return FALLBACK_DISPLAY_NAME;

  const characters = Array.from(cleaned);
  if (characters.length <= MAX_DISPLAY_NAME_LENGTH) return cleaned;

  const dot = cleaned.lastIndexOf('.');
  const extension = dot > 0 ? cleaned.slice(dot) : '';
  const extensionLength = Array.from(extension).length;
  if (extensionLength === 0 || extensionLength > 10) {
    return characters.slice(0, MAX_DISPLAY_NAME_LENGTH).join('').trimEnd();
  }

  const keep = MAX_DISPLAY_NAME_LENGTH - extensionLength;
  return characters.slice(0, keep).join('').trimEnd() + extension;
}

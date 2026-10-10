import { Divisi } from '../../common/enums/divisi.enum';

export const DESCRIPTION_MIN_LENGTH = 10;

export const DESCRIPTION_MAX_LENGTH = 2000;

export const DESCRIPTION_PREVIEW_LENGTH = 120;

export function canSendTicket(fromDivisi: Divisi, toDivisi: Divisi): boolean {
  return fromDivisi !== toDivisi;
}

export function isDescriptionLengthValid(description: string): boolean {
  const length = [...description].length;
  return length >= DESCRIPTION_MIN_LENGTH && length <= DESCRIPTION_MAX_LENGTH;
}

export function toDescriptionPreview(description: string): string {
  const flattened = description.replace(/\s+/g, ' ').trim();
  const characters = [...flattened];
  if (characters.length <= DESCRIPTION_PREVIEW_LENGTH) return flattened;
  return `${characters.slice(0, DESCRIPTION_PREVIEW_LENGTH).join('').trimEnd()}…`;
}

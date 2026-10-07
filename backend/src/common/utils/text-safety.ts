const LONE_SURROGATE = /\p{Cs}/u;

const FORMAT_CHARACTER = /\p{Cf}/u;

const DISALLOWED_CONTROL_CHARACTER = /[^\P{Cc}\n\t]/u;

export function hasLoneSurrogate(value: string): boolean {
  return LONE_SURROGATE.test(value);
}

export function hasUnsafeInvisibleCharacter(value: string): boolean {
  return DISALLOWED_CONTROL_CHARACTER.test(value) || FORMAT_CHARACTER.test(value);
}

export function normalizeMultilineText(value: string): string {
  return value.replace(/\r\n?/g, '\n').trim();
}
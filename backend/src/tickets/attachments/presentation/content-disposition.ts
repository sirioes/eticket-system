const ASCII_UNSAFE = /[^A-Za-z0-9._ -]/g;
const LONE_SURROGATE = /\p{Cs}/gu;
const RFC_5987_RESERVED = /['()*]/g;

export function attachmentDisposition(fileName: string): string {
  const wellFormed = fileName.replace(LONE_SURROGATE, '\uFFFD');
  const fallback = wellFormed.replace(ASCII_UNSAFE, '_');
  const encoded = encodeURIComponent(wellFormed).replace(
    RFC_5987_RESERVED,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

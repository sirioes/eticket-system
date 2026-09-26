export function normalizeFullName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}
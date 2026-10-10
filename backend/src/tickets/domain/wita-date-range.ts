const WITA_OFFSET_MS = 8 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function startOfWitaDay(date: string): Date | null {
  const match = CALENDAR_DATE.exec(date);
  if (match === null) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcMidnight = new Date(Date.UTC(year, month - 1, day));

  if (
    utcMidnight.getUTCFullYear() !== year ||
    utcMidnight.getUTCMonth() !== month - 1 ||
    utcMidnight.getUTCDate() !== day
  ) {
    return null;
  }

  return new Date(utcMidnight.getTime() - WITA_OFFSET_MS);
}

export function startOfNextWitaDay(date: string): Date | null {
  const start = startOfWitaDay(date);
  return start === null ? null : new Date(start.getTime() + DAY_MS);
}

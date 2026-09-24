import { Divisi } from './divisi.enum';

export const DIVISI_CODE: Record<Divisi, string> = {
  [Divisi.IT]: 'IT',
  [Divisi.FINANCE]: 'FIN',
  [Divisi.TAX]: 'TAX',
  [Divisi.YOUTUBE]: 'YT',
  [Divisi.DIGITAL_MARKETING]: 'DM',
  [Divisi.DESIGN]: 'DSN',
  [Divisi.PROJECT]: 'PRJ',
  [Divisi.LEGAL]: 'LGL',
  [Divisi.SO]: 'SO',
};

export function toDivisiCode(divisi: Divisi): string {
  return DIVISI_CODE[divisi];
}
import { Divisi } from '@/types/auth.types';

export const DIVISI_LABEL: Record<Divisi, string> = {
  IT: 'IT',
  FINANCE: 'Finance',
  TAX: 'Pajak',
  YOUTUBE: 'YouTube',
  DIGITAL_MARKETING: 'Digital Marketing',
  DESIGN: 'Design',
  PROJECT: 'Project',
  LEGAL: 'Legal',
  SO: 'SO',
};

export function formatDateWita(date: string | Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Makassar',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}
export type Role = 'SUPERADMIN' | 'TEAM_MAIN_OFFICE' | 'MANAGER_MAIN_OFFICE' | 'FINANCE_MAIN_OFFICE' | 'FINANCE_MANAGER_MAIN_OFFICE';
export type Divisi = 'IT' | 'FINANCE' | 'TAX' | 'YOUTUBE' | 'DIGITAL_MARKETING' | 'DESIGN' | 'PROJECT' | 'LEGAL' | 'SO';

export interface SessionUser {
  id: number;
  fullName: string;
  role: Role;
  divisi: Divisi | null;
}
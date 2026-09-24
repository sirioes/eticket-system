import { Role } from './role.enum';
import { Divisi } from './divisi.enum';

export function isValidRoleDivisiCombo(role: Role, divisi: Divisi | null | undefined): boolean {
  if (role === Role.SUPERADMIN) {
    return divisi === null || divisi === undefined; 
  }
  if (role === Role.FINANCE_MAIN_OFFICE || role === Role.FINANCE_MANAGER_MAIN_OFFICE) {
    return divisi === Divisi.FINANCE; 
  }
  if (role === Role.TEAM_MAIN_OFFICE || role === Role.MANAGER_MAIN_OFFICE) {
    return divisi !== null && divisi !== undefined && divisi !== Divisi.FINANCE; 
  }
  return false;
}
import { DIVISI_LABEL } from "@/lib/labels";
import type { Divisi, Role } from "@/types/auth.types";
import type { ManagedUser } from "@/types/user.types";

export const ROLE_LABEL: Record<Role, string> = {
  SUPERADMIN: "Superadmin",
  TEAM_MAIN_OFFICE: "Staf",
  MANAGER_MAIN_OFFICE: "Manajer",
  FINANCE_MAIN_OFFICE: "Staf Finance",
  FINANCE_MANAGER_MAIN_OFFICE: "Manajer Finance",
};

export const ROLES = Object.keys(ROLE_LABEL) as Role[];

const ALL_DIVISI = Object.keys(DIVISI_LABEL) as Divisi[];

export const NON_FINANCE_DIVISI = ALL_DIVISI.filter(
  (divisi) => divisi !== "FINANCE",
);

export const MIN_PASSWORD_LENGTH = 8;

export const MAX_PASSWORD_LENGTH = 128;

export const FULL_NAME_MAX_LENGTH = 191;

export type DivisiRule =
  | { kind: "none" }
  | { kind: "fixed"; divisi: Divisi }
  | { kind: "choose"; options: Divisi[] };

export function divisiRuleFor(role: Role): DivisiRule {
  if (role === "SUPERADMIN") return { kind: "none" };
  if (
    role === "FINANCE_MAIN_OFFICE" ||
    role === "FINANCE_MANAGER_MAIN_OFFICE"
  ) {
    return { kind: "fixed", divisi: "FINANCE" };
  }
  return { kind: "choose", options: NON_FINANCE_DIVISI };
}

export function divisiAfterRoleChange(
  role: Role,
  current: Divisi | null,
): Divisi | null {
  const rule = divisiRuleFor(role);
  if (rule.kind === "none") return null;
  if (rule.kind === "fixed") return rule.divisi;
  return current !== null && rule.options.includes(current) ? current : null;
}

export function isManagerRole(role: Role): boolean {
  return (
    role === "MANAGER_MAIN_OFFICE" || role === "FINANCE_MANAGER_MAIN_OFFICE"
  );
}

export function managerWarning(
  target: ManagedUser,
  next: { role: Role; divisi: Divisi | null; isActive: boolean },
  users: ManagedUser[],
): string | null {
  if (!target.isActive || !isManagerRole(target.role) || target.divisi === null)
    return null;
  const stillCovers =
    next.isActive && next.role === target.role && next.divisi === target.divisi;
  if (stillCovers) return null;
  const otherManager = users.some(
    (user) =>
      user.id !== target.id &&
      user.isActive &&
      user.role === target.role &&
      user.divisi === target.divisi,
  );
  if (otherManager) return null;
  return `Dia satu-satunya ${ROLE_LABEL[target.role].toLowerCase()} aktif di divisi ${DIVISI_LABEL[target.divisi]}. Pengaduan yang menunggu persetujuannya akan tertahan sampai ada ${ROLE_LABEL[target.role].toLowerCase()} aktif lain di divisi itu.`;
}

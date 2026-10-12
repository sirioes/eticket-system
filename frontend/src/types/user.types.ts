import type { Divisi, Role } from "@/types/auth.types";

export interface ManagedUser {
  id: number;
  fullName: string;
  role: Role;
  divisi: Divisi | null;
  isActive: boolean;
}

export interface CreateUserInput {
  fullName: string;
  role: Role;
  divisi: Divisi | null;
  password: string;
}

export interface UpdateUserInput {
  role?: Role;
  divisi?: Divisi | null;
  isActive?: boolean;
}

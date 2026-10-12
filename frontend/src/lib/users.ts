import { api } from "@/lib/api";
import type { CreateUserInput, ManagedUser, UpdateUserInput } from "@/types/user.types";

const USER_ID_PATTERN = /^[1-9][0-9]{0,9}$/;

function userPath(id: number): string {
  const text = String(id);
  if (!USER_ID_PATTERN.test(text)) throw new RangeError("ID akun tidak valid");
  return `/users/${text}`;
}

export function listUsers(): Promise<ManagedUser[]> {
  return api.get<ManagedUser[]>("/users");
}

export function createUser(input: CreateUserInput): Promise<ManagedUser> {
  return api.post<ManagedUser>("/users", {
    fullName: input.fullName,
    role: input.role,
    divisi: input.divisi,
    password: input.password,
  });
}

export function updateUser(id: number, input: UpdateUserInput): Promise<ManagedUser> {
  return api.patch<ManagedUser>(userPath(id), input);
}

export function resetUserPassword(id: number, newPassword: string): Promise<void> {
  return api.patch<void>(`${userPath(id)}/reset-password`, { newPassword });
}

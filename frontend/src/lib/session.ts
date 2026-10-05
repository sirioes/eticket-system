import { api, isUnauthorized } from "@/lib/api";
import type { SessionUser } from "@/types/auth.types";

export interface LoginInput {
  fullName: string;
  password: string;
}

interface SessionResponse {
  user: SessionUser;
}

interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export async function login(input: LoginInput): Promise<SessionUser> {
  const { user } = await api.post<SessionResponse>("/auth/login", input);
  return user;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const { user } = await api.get<SessionResponse>("/auth/me");
    return user;
  } catch (error) {
    if (isUnauthorized(error)) return null;
    throw error;
  }
}

export function logout(): Promise<void> {
  return api.post<void>("/auth/logout");
}

export function changePassword(input: ChangePasswordInput): Promise<void> {
  return api.patch<void>("/auth/password", {
    currentPassword: input.currentPassword,
    newPassword: input.newPassword,
  });
}
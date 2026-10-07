"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "@/types/auth.types";

export const UserContext = createContext<SessionUser | null>(null);

export function useUser(): SessionUser {
  const user = useContext(UserContext);
  if (!user) throw new Error("useUser harus dipakai di dalam dashboard");
  return user;
}

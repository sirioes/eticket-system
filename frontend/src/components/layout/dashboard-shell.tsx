"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import type { SessionUser } from "@/types/auth.types";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { UserContext } from "@/components/layout/user-context";

export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((current) => {
        if (!active) return;
        if (current) setUser(current);
        else router.replace("/login?reason=expired");
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [router, attempt]);

  if (!user) {
    return (
      <div className="grid flex-1 place-items-center bg-haze p-6 text-center">
        {failed ? (
          <div className="animate-fade-up">
            <p className="font-medium">Tidak dapat memuat sesi.</p>
            <button
              type="button"
              onClick={() => {
                setFailed(false);
                setAttempt((value) => value + 1);
              }}
              className="mt-4 rounded-xl bg-teal px-5 py-2.5 text-sm font-semibold text-mist transition-colors duration-200 hover:bg-ink"
            >
              Coba lagi
            </button>
          </div>
        ) : (
          <span
            role="status"
            aria-label="Memuat sesi"
            className="size-8 animate-spin rounded-full border-3 border-teal/20 border-t-teal"
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 bg-haze">
      <Sidebar user={user} open={menuOpen} onClose={closeMenu} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar menuOpen={menuOpen} onMenu={() => setMenuOpen(true)} />
        <main className="flex-1 px-4 pb-10 sm:px-6 lg:px-10">
          <UserContext value={user}>{children}</UserContext>
        </main>
      </div>
    </div>
  );
}
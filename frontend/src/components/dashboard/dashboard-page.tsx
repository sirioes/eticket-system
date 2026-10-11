"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RecentTicketsTable } from "@/components/dashboard/recent-tickets-table";
import { StatCards } from "@/components/dashboard/stat-cards";
import { useUser } from "@/components/layout/user-context";
import { EmptyState } from "@/components/tickets/empty-state";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "@/components/ui/button-class";
import { errorMessage, isUnauthorized } from "@/lib/api";
import { getRecentTickets, getTicketStats } from "@/lib/tickets";
import type { TicketListItem, TicketStats } from "@/types/ticket.types";

type LoadState =
  | { status: "idle"; key: null }
  | { status: "error"; key: string; message: string }
  | { status: "ready"; key: string; stats: TicketStats; recent: TicketListItem[] };

const SECTION_CLASS =
  "animate-fade-up rounded-3xl bg-mist p-4 shadow-[0_24px_60px_-28px_color-mix(in_oklab,var(--color-ink)_35%,transparent)] sm:p-6 lg:p-8";

function Heading() {
  return (
    <header className="animate-fade-up">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard</h1>
      <p className="mt-1 text-sm text-ink/70 sm:text-base">
        Pantau pengaduan keluar dan masuk divisimu di sini.
      </p>
    </header>
  );
}

export function DashboardPage() {
  const user = useUser();
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const requestKey = String(attempt);
  const [load, setLoad] = useState<LoadState>({ status: "idle", key: null });
  const settled = load.key === requestKey;

  useEffect(() => {
    if (user.divisi === null) return;
    let active = true;
    Promise.all([getTicketStats(), getRecentTickets()])
      .then(([stats, recent]) => {
        if (active) setLoad({ status: "ready", key: requestKey, stats, recent });
      })
      .catch((caught: unknown) => {
        if (!active) return;
        if (isUnauthorized(caught)) {
          router.replace("/login?reason=expired");
          return;
        }
        setLoad({ status: "error", key: requestKey, message: errorMessage(caught) });
      });
    return () => {
      active = false;
    };
  }, [router, requestKey, user.divisi]);

  if (user.divisi === null) {
    return (
      <div className="flex flex-col gap-6">
        <Heading />
        <section className="grid min-h-48 animate-fade-up place-items-center rounded-3xl border-2 border-dashed border-teal/25 bg-mist/60 p-8 text-center [animation-delay:80ms]">
          <div>
            <p className="font-mono text-xs tracking-[0.2em] text-teal uppercase">Akun superadmin</p>
            <p className="mt-2 max-w-sm text-sm text-ink/70">
              Akun ini tidak terikat pada divisi, jadi ringkasan pengaduan per divisi tidak ditampilkan.
            </p>
          </div>
        </section>
      </div>
    );
  }

  const viewerDivisi = user.divisi;

  return (
    <div className="flex flex-col gap-6">
      <Heading />

      {!settled && (
        <div className="grid min-h-64 place-items-center">
          <span
            role="status"
            aria-label="Memuat dashboard"
            className="size-8 animate-spin rounded-full border-3 border-teal/20 border-t-teal"
          />
        </div>
      )}

      {load.status === "error" && settled && (
        <div
          role="alert"
          className="flex animate-fade-in flex-col items-start gap-3 rounded-xl bg-red/10 px-4 py-3 text-sm text-wine sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="font-medium">{load.message}</p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className={`${SECONDARY_BUTTON_CLASS} h-10 bg-mist text-ink`}
          >
            Coba lagi
          </button>
        </div>
      )}

      {load.status === "ready" && settled && (
        <>
          <StatCards stats={load.stats} />

          <section aria-label="Pengaduan terbaru" className={`${SECTION_CLASS} [animation-delay:280ms]`}>
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Pengaduan Terbaru</h2>
              {load.recent.length > 0 && (
                <span className="animate-pop-in rounded-full bg-ink px-3 py-1 font-mono text-xs font-semibold text-mist">
                  {load.recent.length} teratas
                </span>
              )}
            </div>

            {load.recent.length === 0 ? (
              <EmptyState
                eyebrow="Masih kosong"
                message="Divisimu belum memiliki pengaduan keluar maupun masuk."
              >
                <Link href="/buat-pengaduan" className={PRIMARY_BUTTON_CLASS}>
                  Buat pengaduan
                </Link>
              </EmptyState>
            ) : (
              <RecentTicketsTable items={load.recent} viewerDivisi={viewerDivisi} />
            )}
          </section>
        </>
      )}
    </div>
  );
}

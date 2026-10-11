"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/components/layout/user-context";
import { EmptyState } from "@/components/tickets/empty-state";
import { ExportButton } from "@/components/tickets/export-button";
import { TicketListToolbar } from "@/components/tickets/ticket-list-toolbar";
import { TicketPagination } from "@/components/tickets/ticket-pagination";
import { TicketTable, type TicketDirection } from "@/components/tickets/ticket-table";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "@/components/ui/button-class";
import { errorMessage, isUnauthorized } from "@/lib/api";
import { DIVISI_LABEL } from "@/lib/labels";
import {
  hasAnyFilter,
  readTicketListState,
  TICKET_PAGE_SIZE,
  writeTicketListState,
  type TicketListState,
} from "@/lib/ticket-list-params";
import { listIncomingTickets, listOutgoingTickets } from "@/lib/tickets";
import type { Divisi } from "@/types/auth.types";
import type { TicketList, TicketListFilters } from "@/types/ticket.types";

const ALL_DIVISI = Object.keys(DIVISI_LABEL) as Divisi[];

const COPY: Record<
  TicketDirection,
  { title: string; subtitle: string; divisiLabel: string; empty: string; emptyHint: string }
> = {
  outgoing: {
    title: "Pengaduan Keluar",
    subtitle: "Pengaduan yang diajukan divisimu ke divisi lain beserta statusnya.",
    divisiLabel: "Divisi tujuan",
    empty: "Divisimu belum mengajukan pengaduan.",
    emptyHint: "Pengaduan yang kamu kirim ke divisi lain akan muncul di sini.",
  },
  incoming: {
    title: "Pengaduan Masuk",
    subtitle: "Pengaduan dari divisi lain yang ditujukan ke divisimu.",
    divisiLabel: "Divisi asal",
    empty: "Belum ada pengaduan masuk ke divisimu.",
    emptyHint: "Pengaduan dari divisi lain akan muncul di sini setelah disetujui manajer asalnya.",
  },
};

type LoadState =
  | { status: "idle"; key: null }
  | { status: "error"; key: string; message: string }
  | { status: "ready"; key: string; data: TicketList };

export function TicketListPage({ direction }: { direction: TicketDirection }) {
  const user = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const copy = COPY[direction];

  const query = searchParams.toString();
  const state = useMemo(() => readTicketListState(new URLSearchParams(query)), [query]);
  const stateKey = writeTicketListState(state);

  const [attempt, setAttempt] = useState(0);
  const requestKey = `${stateKey}#${attempt}`;
  const [load, setLoad] = useState<LoadState>({ status: "idle", key: null });
  const settled = load.key === requestKey;

  useEffect(() => {
    if (user.divisi === null) return;
    let active = true;
    const fetchList = direction === "outgoing" ? listOutgoingTickets : listIncomingTickets;
    fetchList({ ...state.filters, page: state.page, limit: TICKET_PAGE_SIZE })
      .then((data) => {
        if (active) setLoad({ status: "ready", key: requestKey, data });
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
  }, [direction, router, state, requestKey, user.divisi]);

  const refreshing = load.status === "ready" && !settled;
  const showSpinner = load.status === "idle" || (load.status === "error" && !settled);

  function navigate(next: TicketListState) {
    const search = writeTicketListState(next);
    router.push(search === "" ? pathname : `${pathname}?${search}`, { scroll: false });
  }

  function applyFilters(filters: TicketListFilters) {
    navigate({ filters, page: 1 });
  }

  if (user.divisi === null) {
    return (
      <div className="animate-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{copy.title}</h1>
        <p className="mt-6 rounded-xl bg-red/10 px-4 py-3 text-sm font-medium text-wine">
          Halaman ini hanya untuk akun yang terdaftar di sebuah divisi.
        </p>
      </div>
    );
  }

  const ownDivisi = user.divisi;
  const divisiOptions = ALL_DIVISI.filter((divisi) => divisi !== ownDivisi);
  const filtered = hasAnyFilter(state.filters);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex animate-fade-up flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{copy.title}</h1>
          <p className="mt-1 text-sm text-ink/70 sm:text-base">{copy.subtitle}</p>
        </div>
        {direction === "outgoing" && <ExportButton filters={state.filters} />}
      </header>

      <section
        aria-label={`Daftar ${copy.title.toLowerCase()}`}
        className="flex animate-fade-up flex-col gap-6 rounded-3xl bg-mist p-4 shadow-[0_24px_60px_-28px_color-mix(in_oklab,var(--color-ink)_35%,transparent)] [animation-delay:80ms] sm:p-6 lg:p-8"
      >
        <TicketListToolbar
          key={stateKey}
          filters={state.filters}
          divisiOptions={divisiOptions}
          divisiLabel={copy.divisiLabel}
          onApply={applyFilters}
        />

        {showSpinner && (
          <div className="grid min-h-48 place-items-center">
            <span
              role="status"
              aria-label="Memuat daftar pengaduan"
              className="size-8 animate-spin rounded-full border-3 border-teal/20 border-t-teal"
            />
          </div>
        )}

        {load.status === "error" && settled && (
          <div role="alert" className="flex animate-fade-in flex-col items-start gap-3 rounded-xl bg-red/10 px-4 py-3 text-sm text-wine sm:flex-row sm:items-center sm:justify-between">
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

        {load.status === "ready" && load.data.items.length === 0 && load.data.total > 0 && (
          <EmptyState eyebrow="Halaman kosong" message="Halaman ini melewati jumlah halaman yang ada.">
            <button
              type="button"
              onClick={() => navigate({ filters: state.filters, page: 1 })}
              className={PRIMARY_BUTTON_CLASS}
            >
              Ke halaman pertama
            </button>
          </EmptyState>
        )}

        {load.status === "ready" && load.data.total === 0 && filtered && (
          <EmptyState
            eyebrow="Tidak ada hasil"
            message="Tidak ada pengaduan yang cocok dengan pencarian atau filter."
          >
            <button
              type="button"
              onClick={() => applyFilters({})}
              className={`${SECONDARY_BUTTON_CLASS} border border-ink/15`}
            >
              Hapus pencarian dan filter
            </button>
          </EmptyState>
        )}

        {load.status === "ready" && load.data.total === 0 && !filtered && (
          <EmptyState eyebrow="Masih kosong" message={copy.empty}>
            {direction === "outgoing" ? (
              <Link href="/buat-pengaduan" className={PRIMARY_BUTTON_CLASS}>
                Buat pengaduan
              </Link>
            ) : (
              <p className="max-w-sm text-sm text-ink/70">{copy.emptyHint}</p>
            )}
          </EmptyState>
        )}

        {load.status === "ready" && load.data.items.length > 0 && (
          <div
            aria-busy={refreshing}
            className={`flex flex-col gap-6 transition-opacity duration-200 ${refreshing ? "opacity-60" : ""}`}
          >
            <TicketTable
              items={load.data.items}
              firstNumber={(load.data.page - 1) * load.data.limit + 1}
              direction={direction}
            />
            <footer className="flex flex-col gap-4 border-t border-ink/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink/70" aria-live="polite">
                Menampilkan{" "}
                <span className="font-mono font-semibold text-ink">{load.data.items.length}</span> dari{" "}
                <span className="font-mono font-semibold text-ink">{load.data.total}</span> data pengaduan
              </p>
              <TicketPagination
                page={load.data.page}
                totalPages={load.data.totalPages}
                disabled={refreshing}
                onChange={(page) => navigate({ filters: state.filters, page })}
              />
            </footer>
          </div>
        )}
      </section>
    </div>
  );
}

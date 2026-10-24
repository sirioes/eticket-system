"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/layout/user-context";
import { TicketAttachments } from "@/components/tickets/ticket-attachments";
import { TicketComments } from "@/components/tickets/ticket-comments";
import { TicketNotFound } from "@/components/tickets/ticket-not-found";
import { TicketStatusPanel } from "@/components/tickets/ticket-status-panel";
import { TicketTimeline } from "@/components/tickets/ticket-timeline";
import { SECONDARY_BUTTON_CLASS } from "@/components/ui/button-class";
import { CARD_CLASS } from "@/components/ui/card-class";
import { ApiError, errorMessage, isUnauthorized } from "@/lib/api";
import { DIVISI_LABEL, formatDateWita } from "@/lib/labels";
import { ticketProgress } from "@/lib/ticket-progress";
import { getTicket } from "@/lib/tickets";
import type { SessionUser } from "@/types/auth.types";
import type { TicketDetail } from "@/types/ticket.types";

type LoadState =
  | { status: "idle"; key: null }
  | { status: "missing"; key: string }
  | { status: "error"; key: string; message: string }
  | { status: "ready"; key: string; data: TicketDetail };

function backLink(user: SessionUser, ticket: TicketDetail): { href: string; label: string } {
  if (user.role === "SUPERADMIN") {
    return { href: "/semua-pengaduan", label: "Semua Pengaduan" };
  }
  if (user.divisi === ticket.fromDivisi) {
    return { href: "/daftar-pengaduan/keluar", label: "Pengaduan Keluar" };
  }
  if (user.divisi === ticket.toDivisi) {
    return { href: "/daftar-pengaduan/masuk", label: "Pengaduan Masuk" };
  }
  return { href: "/", label: "Dashboard" };
}

function InfoItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-mono text-xs tracking-[0.15em] text-ink/70 uppercase">{label}</dt>
      <dd className="font-medium wrap-break-word">{children}</dd>
    </div>
  );
}

export function TicketDetailPage({ id }: { id: string }) {
  const user = useUser();
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${id}#${attempt}`;
  const [load, setLoad] = useState<LoadState>({ status: "idle", key: null });
  const settled = load.key === requestKey;

  useEffect(() => {
    let active = true;
    getTicket(id)
      .then((data) => {
        if (active) setLoad({ status: "ready", key: requestKey, data });
      })
      .catch((caught: unknown) => {
        if (!active) return;
        if (isUnauthorized(caught)) {
          router.replace("/login?reason=expired");
          return;
        }
        if (caught instanceof ApiError && (caught.status === 404 || caught.status === 400)) {
          setLoad({ status: "missing", key: requestKey });
          return;
        }
        setLoad({ status: "error", key: requestKey, message: errorMessage(caught) });
      });
    return () => {
      active = false;
    };
  }, [id, requestKey, router]);

  const reload = () => setAttempt((value) => value + 1);

  if (load.status === "missing") return <TicketNotFound />;

  if (load.status === "idle" || (load.status === "error" && !settled)) {
    return (
      <div className="grid min-h-[60dvh] place-items-center">
        <span
          role="status"
          aria-label="Memuat detail pengaduan"
          className="size-8 animate-spin rounded-full border-3 border-teal/20 border-t-teal"
        />
      </div>
    );
  }

  if (load.status === "error") {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="animate-fade-up text-2xl font-semibold tracking-tight sm:text-3xl">Detail Pengaduan</h1>
        <div role="alert" className="flex animate-fade-in flex-col items-start gap-3 rounded-xl bg-red/10 px-4 py-3 text-sm text-wine sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium">{load.message}</p>
          <button type="button" onClick={reload} className={`${SECONDARY_BUTTON_CLASS} h-10 bg-mist text-ink`}>
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  const ticket = load.data;
  const refreshing = !settled;
  const back = backLink(user, ticket);

  return (
    <div aria-busy={refreshing} className="flex flex-col gap-6">
      <header className="flex animate-fade-up flex-col gap-3">
        <Link
          href={back.href}
          className="group inline-flex w-fit items-center gap-2 rounded-lg text-sm font-medium text-teal transition-colors duration-200 hover:text-ink"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 transition-transform duration-200 ease-spring group-hover:-translate-x-1" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Kembali ke {back.label}
        </Link>
        <div>
          <p className="font-mono text-xs tracking-[0.15em] text-ink/70 uppercase">Detail pengaduan</p>
          <h1 className="mt-1 font-mono text-2xl font-semibold tracking-tight wrap-break-word sm:text-3xl">{ticket.id}</h1>
          <p className="mt-1 text-sm text-ink/70 sm:text-base">
            Dari Divisi {DIVISI_LABEL[ticket.fromDivisi]} ke Divisi {DIVISI_LABEL[ticket.toDivisi]}
          </p>
        </div>
      </header>

      <TicketStatusPanel ticket={ticket} refreshing={refreshing} onChanged={reload} />

      {ticket.canReadComments && ticket.stage !== "MENUNGGU_MANAGER_ASAL" && (
        <TicketComments key={ticket.id} ticket={ticket} onChanged={reload} />
      )}

      <section aria-labelledby="progress-title" className={`${CARD_CLASS} animate-fade-up [animation-delay:120ms]`}>
        <h2 id="progress-title" className="text-lg font-semibold">
          Riwayat Pengaduan
        </h2>
        <div className="mt-6">
          <TicketTimeline steps={ticketProgress(ticket)} />
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="info-title" className={`${CARD_CLASS} animate-fade-up [animation-delay:180ms]`}>
          <h2 id="info-title" className="text-lg font-semibold">
            Informasi Pengaduan
          </h2>
          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <InfoItem label="Divisi asal">{DIVISI_LABEL[ticket.fromDivisi]}</InfoItem>
            <InfoItem label="Divisi tujuan">{DIVISI_LABEL[ticket.toDivisi]}</InfoItem>
            <InfoItem label="Dibuat oleh">{ticket.createdBy.fullName}</InfoItem>
            <InfoItem label="Tanggal dibuat">
              <time dateTime={ticket.createdAt} className="font-mono text-sm">
                {formatDateWita(ticket.createdAt)}
              </time>
            </InfoItem>
          </dl>
          <div className="mt-6 border-t border-ink/10 pt-5">
            <h3 className="font-mono text-xs tracking-[0.15em] text-ink/70 uppercase">Keterangan</h3>
            <p className="mt-2 leading-relaxed whitespace-pre-line wrap-break-word">{ticket.description}</p>
          </div>
        </section>

        <TicketAttachments ticket={ticket} refreshing={refreshing} onChanged={reload} />
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/components/layout/user-context";
import { TicketComments } from "@/components/tickets/ticket-comments";
import { TicketFiles } from "@/components/tickets/ticket-files";
import { TicketInfoPanel } from "@/components/tickets/ticket-info-panel";
import { TicketNotFound } from "@/components/tickets/ticket-not-found";
import { TicketSummary } from "@/components/tickets/ticket-summary";
import { TicketTimeline } from "@/components/tickets/ticket-timeline";
import { useTicketMessages } from "@/components/tickets/use-ticket-messages";
import { SECONDARY_BUTTON_CLASS } from "@/components/ui/button-class";
import { CARD_SURFACE_CLASS } from "@/components/ui/card-class";
import { TabList, TabPanel, type TabItem } from "@/components/ui/tabs";
import { ApiError, errorMessage, isUnauthorized } from "@/lib/api";
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

type TabId = "informasi" | "berkas" | "komentar" | "riwayat";

const TAB_PREFIX = "ticket-detail";

const DEFAULT_TAB: TabId = "informasi";

function closedStage(ticket: TicketDetail): boolean {
  return ticket.stage === "SELESAI" || ticket.stage === "DITOLAK";
}

interface TicketDetailContentProps {
  ticket: TicketDetail;
  refreshing: boolean;
  onChanged: () => void;
}

function TicketDetailContent({ ticket, refreshing, onChanged }: TicketDetailContentProps) {
  const user = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const back = backLink(user, ticket);
  const showComments = ticket.canReadComments && ticket.stage !== "MENUNGGU_MANAGER_ASAL";

  const available: TabId[] = showComments
    ? ["informasi", "berkas", "komentar", "riwayat"]
    : ["informasi", "berkas", "riwayat"];
  const requested = searchParams.get("tab");
  const activeTab = available.find((tab) => tab === requested) ?? DEFAULT_TAB;

  const messages = useTicketMessages({
    ticketId: ticket.id,
    enabled: showComments && activeTab === "komentar",
    polling: showComments && activeTab === "komentar" && !closedStage(ticket),
    onGone: onChanged,
  });

  const messageCount =
    messages.state.status === "ready"
      ? messages.state.messages.filter((message) => message.kind === "KOMENTAR").length
      : undefined;
  const tabs: TabItem[] = available.map((id) => {
    switch (id) {
      case "informasi":
        return { id, label: "Informasi Pengaduan" };
      case "berkas":
        return { id, label: "Berkas", count: ticket.attachments.length + ticket.completionFiles.length };
      case "komentar":
        return { id, label: "Komentar", count: messageCount };
      case "riwayat":
        return { id, label: "Riwayat Pengaduan" };
    }
  });

  function selectTab(id: string) {
    if (id === activeTab) return;
    if (id === "komentar") messages.refresh();
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div aria-busy={refreshing} className="flex flex-col gap-4 lg:gap-6">
      <Link
        href={back.href}
        className="group inline-flex w-fit animate-fade-up items-center gap-2 rounded-lg text-sm font-medium text-teal transition-colors duration-200 hover:text-ink"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 transition-transform duration-200 ease-spring group-hover:-translate-x-1" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Kembali ke {back.label}
      </Link>

      <TicketSummary ticket={ticket} refreshing={refreshing} onChanged={onChanged} />

      <div className={CARD_SURFACE_CLASS}>
        <TabList idPrefix={TAB_PREFIX} label="Isi pengaduan" tabs={tabs} active={activeTab} onChange={selectTab} />

        <TabPanel idPrefix={TAB_PREFIX} id="informasi" active={activeTab === "informasi"}>
          <TicketInfoPanel ticket={ticket} />
        </TabPanel>

        <TabPanel idPrefix={TAB_PREFIX} id="berkas" active={activeTab === "berkas"}>
          <TicketFiles ticket={ticket} refreshing={refreshing} onChanged={onChanged} />
        </TabPanel>

        {showComments && (
          <TabPanel idPrefix={TAB_PREFIX} id="komentar" active={activeTab === "komentar"}>
            <TicketComments
              ticket={ticket}
              messages={messages.state}
              active={activeTab === "komentar"}
              onSent={messages.refresh}
              onChanged={onChanged}
              onBack={() => selectTab("informasi")}
            />
          </TabPanel>
        )}

        <TabPanel idPrefix={TAB_PREFIX} id="riwayat" active={activeTab === "riwayat"}>
          <div className="flex flex-col gap-6">
            <h2 className="text-lg font-semibold">Riwayat Pengaduan</h2>
            <TicketTimeline steps={ticketProgress(ticket)} />
          </div>
        </TabPanel>
      </div>
    </div>
  );
}

export function TicketDetailPage({ id }: { id: string }) {
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

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

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

  return <TicketDetailContent ticket={load.data} refreshing={!settled} onChanged={reload} />;
}

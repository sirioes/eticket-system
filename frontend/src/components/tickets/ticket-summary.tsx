"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { refreshActionCounts } from "@/components/layout/use-action-counts";
import { CompleteDialog } from "@/components/tickets/complete-dialog";
import {
  ReasonDialog,
  type ReasonAction,
} from "@/components/tickets/reason-dialog";
import { TicketExportButton } from "@/components/tickets/ticket-export-button";
import { TicketStatCard } from "@/components/tickets/ticket-stat-card";
import { CARD_SURFACE_CLASS } from "@/components/ui/card-class";
import { ApiError, errorMessage, isUnauthorized } from "@/lib/api";
import { DIVISI_LABEL, STAGE_ACTION_LABEL } from "@/lib/labels";
import {
  MAX_ATTACHMENTS_PER_TICKET,
  MAX_COMPLETION_FILES,
} from "@/lib/ticket-rules";
import { stageNumber } from "@/lib/ticket-progress";
import { advanceTicketStage, completeTicket } from "@/lib/tickets";
import type { StageAction, TicketDetail } from "@/types/ticket.types";

interface Notice {
  tone: "success" | "error";
  message: string;
}

interface ActionCopy {
  title: string;
  description: string;
  confirm: string;
  success: string;
}

const PROCEED_BUTTON_CLASS =
  "flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-teal px-5 text-sm font-semibold text-mist transition-[background-color,transform] duration-200 ease-smooth hover:bg-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80 sm:flex-none";

const DANGER_BUTTON_CLASS =
  "flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-red bg-mist px-5 text-sm font-semibold text-red transition-[background-color,color,transform] duration-200 ease-spring hover:bg-red hover:text-mist active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none";

function StatIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function StepsIcon() {
  return (
    <StatIcon>
      <path d="M9 6h11M9 12h11M9 18h11M4 6l.01 0M4 12l.01 0M4 18l.01 0" />
    </StatIcon>
  );
}

function FileIcon() {
  return (
    <StatIcon>
      <path d="M6 3h9l4 4v14H6zM15 3v4h4" />
    </StatIcon>
  );
}

function FileCheckIcon() {
  return (
    <StatIcon>
      <path d="M6 3h9l4 4v14H6zM15 3v4h4M9.5 14l2 2 3.5-4" />
    </StatIcon>
  );
}

const REFRESH_STATUSES = new Set([403, 404, 409]);

function isReasonAction(action: StageAction): action is ReasonAction {
  return action === "TERIMA" || action === "TOLAK";
}

function actionCopy(ticket: TicketDetail, action: StageAction): ActionCopy {
  const toLabel = DIVISI_LABEL[ticket.toDivisi];
  switch (action) {
    case "TERIMA": {
      const target =
        ticket.stage === "MENUNGGU_MANAGER_ASAL"
          ? `manajer Divisi ${toLabel}`
          : `staf Divisi ${toLabel}`;
      return {
        title: "Terima pengaduan ini?",
        description: `Pengaduan akan diteruskan ke ${target}.`,
        confirm: "Ya, terima",
        success: `Pengaduan diterima dan diteruskan ke ${target}.`,
      };
    }
    case "TOLAK":
      return {
        title: "Tolak pengaduan ini?",
        description:
          "Penolakan bersifat permanen. Pengaduan akan ditutup dengan status Ditolak dan tidak dapat diproses lagi.",
        confirm: "Ya, tolak",
        success: "Pengaduan ditolak.",
      };
    case "PROSES":
      return {
        title: "Mulai proses pengaduan ini?",
        description: "Status pengaduan akan berubah menjadi Diproses.",
        confirm: "Ya, proses",
        success: "Pengaduan mulai diproses.",
      };
    case "SELESAI":
      return {
        title: "Tandai pengaduan ini selesai?",
        description: "Status pengaduan akan berubah menjadi Selesai.",
        confirm: "Ya, selesai",
        success: "Pengaduan ditandai selesai.",
      };
  }
}

interface TicketSummaryProps {
  ticket: TicketDetail;
  refreshing: boolean;
  onChanged: () => void;
}

export function TicketSummary({
  ticket,
  refreshing,
  onChanged,
}: TicketSummaryProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState<StageAction | null>(null);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [completing, setCompleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const actions = ticket.availableActions;
  const copy = pending ? actionCopy(ticket, pending) : null;
  const reasonCopy = reasonAction ? actionCopy(ticket, reasonAction) : null;

  function open(action: StageAction) {
    setNotice(null);
    if (isReasonAction(action)) {
      setReasonAction(action);
      return;
    }
    if (action === "SELESAI") {
      setCompleting(true);
      return;
    }
    setPending(action);
    dialogRef.current?.showModal();
  }

  function close() {
    if (!busy) dialogRef.current?.close();
  }

  async function run(task: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    let keepCompleteOpen = false;
    try {
      await task();
      setNotice({ tone: "success", message: success });
      refreshActionCounts();
      onChanged();
    } catch (caught) {
      if (isUnauthorized(caught)) {
        router.replace("/login?reason=expired");
        return;
      }
      setNotice({ tone: "error", message: errorMessage(caught) });
      if (caught instanceof ApiError && REFRESH_STATUSES.has(caught.status)) {
        refreshActionCounts();
        onChanged();
      } else {
        keepCompleteOpen = true;
      }
    } finally {
      setBusy(false);
      setReasonAction(null);
      if (!keepCompleteOpen) setCompleting(false);
      dialogRef.current?.close();
    }
  }

  function confirm() {
    if (pending && copy)
      void run(() => advanceTicketStage(ticket.id, pending), copy.success);
  }

  return (
    <section
      aria-labelledby="summary-title"
      className={`${CARD_SURFACE_CLASS} flex animate-fade-up flex-col gap-4 p-4 [animation-delay:80ms] sm:p-5`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-[0.15em] text-ink/70 uppercase">
            Detail pengaduan
          </p>
          <h1
            id="summary-title"
            className="font-mono text-xl font-semibold tracking-tight wrap-break-word sm:text-2xl"
          >
            {ticket.id}
          </h1>
          <p className="text-sm text-ink/70">
            Dari Divisi {DIVISI_LABEL[ticket.fromDivisi]} ke Divisi{" "}
            {DIVISI_LABEL[ticket.toDivisi]}
          </p>
        </div>

        <div className="flex gap-2 sm:justify-end sm:gap-3 md:shrink-0">
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              disabled={busy || refreshing}
              onClick={() => open(action)}
              className={
                action === "TOLAK" ? DANGER_BUTTON_CLASS : PROCEED_BUTTON_CLASS
              }
            >
              {STAGE_ACTION_LABEL[action]}
            </button>
          ))}
          <TicketExportButton
            ticketId={ticket.id}
            disabled={busy}
            onError={(message) => setNotice({ tone: "error", message })}
          />
        </div>
      </div>

      {notice?.tone === "success" && (
        <p
          key={notice.message}
          role="status"
          className="animate-pop-in rounded-xl bg-green/15 px-4 py-3 text-sm font-medium text-ink"
        >
          {notice.message}
        </p>
      )}
      {notice?.tone === "error" && (
        <p
          key={notice.message}
          role="alert"
          className="animate-shake rounded-xl bg-red/10 px-4 py-3 text-sm font-medium text-wine"
        >
          {notice.message}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <TicketStatCard
          icon={<StepsIcon />}
          label="Tahap persetujuan"
          value={stageNumber(ticket)}
          unit="/5 tahap"
        />
        <TicketStatCard
          icon={<FileIcon />}
          label="Dokumen Pengaduan"
          value={ticket.attachments.length}
          unit={`/${MAX_ATTACHMENTS_PER_TICKET} file`}
        />
        <TicketStatCard
          icon={<FileCheckIcon />}
          label="Dokumen Penyelesaian"
          value={ticket.completionFiles.length}
          unit={`/${MAX_COMPLETION_FILES} file`}
        />
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="stage-dialog-title"
        aria-describedby="stage-dialog-description"
        onCancel={(event) => busy && event.preventDefault()}
        onClick={(event) => event.target === event.currentTarget && close()}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl bg-mist text-ink shadow-[0_30px_80px_-24px_color-mix(in_oklab,var(--color-ink)_60%,transparent)] backdrop:bg-ink/40 backdrop:backdrop-blur-sm open:animate-pop-in"
      >
        {copy && pending && (
          <div className="p-6">
            <h2 id="stage-dialog-title" className="text-lg font-semibold">
              {copy.title}
            </h2>
            <p className="mt-1 font-mono text-sm font-semibold wrap-break-word">
              {ticket.id}
            </p>
            <p
              id="stage-dialog-description"
              className="mt-3 text-sm text-ink/70"
            >
              {copy.description} Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                autoFocus
                onClick={close}
                disabled={busy}
                className="h-11 rounded-xl border border-ink/15 px-5 text-sm font-semibold text-ink transition-colors duration-200 hover:bg-ink/5 disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={busy}
                aria-busy={busy}
                className={`flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-mist transition-[background-color,transform] duration-200 ease-spring active:scale-95 disabled:cursor-not-allowed disabled:opacity-80 bg-teal hover:bg-ink`}
              >
                {busy && (
                  <span
                    aria-hidden="true"
                    className="size-4 animate-spin rounded-full border-2 border-mist/40 border-t-mist"
                  />
                )}
                {busy ? "Menyimpan…" : copy.confirm}
              </button>
            </div>
          </div>
        )}
      </dialog>

      {reasonAction && reasonCopy && (
        <ReasonDialog
          action={reasonAction}
          ticketId={ticket.id}
          title={reasonCopy.title}
          description={`${reasonCopy.description} Tindakan ini tidak dapat dibatalkan.`}
          confirmLabel={reasonCopy.confirm}
          busy={busy}
          onSubmit={(reason) =>
            void run(
              () => advanceTicketStage(ticket.id, reasonAction, reason),
              reasonCopy.success,
            )
          }
          onClose={() => setReasonAction(null)}
        />
      )}

      {completing && (
        <CompleteDialog
          ticketId={ticket.id}
          busy={busy}
          error={notice?.tone === "error" ? notice.message : null}
          onSubmit={(files) =>
            void run(
              () => completeTicket(ticket.id, files),
              actionCopy(ticket, "SELESAI").success,
            )
          }
          onClose={() => setCompleting(false)}
        />
      )}
    </section>
  );
}

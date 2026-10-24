"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/layout/user-context";
import { refreshActionCounts } from "@/components/layout/use-action-counts";
import { ReasonDialog, type ReasonAction } from "@/components/tickets/reason-dialog";
import { StatusBadge } from "@/components/tickets/status-badge";
import { PRIMARY_BUTTON_CLASS } from "@/components/ui/button-class";
import { CARD_CLASS } from "@/components/ui/card-class";
import { ApiError, errorMessage, isUnauthorized } from "@/lib/api";
import { DIVISI_LABEL, STAGE_ACTION_LABEL } from "@/lib/labels";
import { stageSummary } from "@/lib/ticket-progress";
import { advanceTicketStage } from "@/lib/tickets";
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

const DANGER_BUTTON_CLASS =
  "flex h-12 items-center justify-center gap-2 rounded-xl border border-red bg-mist px-6 font-semibold text-red transition-[background-color,color,transform] duration-200 ease-spring hover:bg-red hover:text-mist active:scale-95 disabled:cursor-not-allowed disabled:opacity-60";

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
        description: "Penolakan bersifat permanen. Pengaduan akan ditutup dengan status Ditolak dan tidak dapat diproses lagi.",
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

interface TicketStatusPanelProps {
  ticket: TicketDetail;
  refreshing: boolean;
  onChanged: () => void;
}

export function TicketStatusPanel({ ticket, refreshing, onChanged }: TicketStatusPanelProps) {
  const router = useRouter();
  const user = useUser();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState<StageAction | null>(null);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const terminal = ticket.stage === "SELESAI" || ticket.stage === "DITOLAK";
  const actions = ticket.availableActions;
  const copy = pending ? actionCopy(ticket, pending) : null;
  const reasonCopy = reasonAction ? actionCopy(ticket, reasonAction) : null;

  function open(action: StageAction) {
    setNotice(null);
    if (isReasonAction(action)) {
      setReasonAction(action);
      return;
    }
    setPending(action);
    dialogRef.current?.showModal();
  }

  function close() {
    if (!busy) dialogRef.current?.close();
  }

  async function run(action: StageAction, success: string, reason?: string) {
    if (busy) return;
    setBusy(true);
    try {
      await advanceTicketStage(ticket.id, action, reason);
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
      }
    } finally {
      setBusy(false);
      setReasonAction(null);
      dialogRef.current?.close();
    }
  }

  function confirm() {
    if (pending && copy) void run(pending, copy.success);
  }

  return (
    <section
      aria-labelledby="status-title"
      className={`${CARD_CLASS} flex animate-fade-up flex-col gap-5 [animation-delay:80ms]`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-col items-start gap-3">
          <h2 id="status-title" className="font-mono text-xs tracking-[0.15em] text-ink/70 uppercase">
            Status saat ini
          </h2>
          <StatusBadge key={ticket.stage} stage={ticket.stage} fromDivisi={ticket.fromDivisi} toDivisi={ticket.toDivisi} wrap />
          <p className="text-sm text-ink/70 sm:text-base">{stageSummary(ticket)}</p>
        </div>

        {actions.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row md:shrink-0">
            {actions.map((action) => (
              <button
                key={action}
                type="button"
                disabled={busy || refreshing}
                onClick={() => open(action)}
                className={action === "TOLAK" ? DANGER_BUTTON_CLASS : PRIMARY_BUTTON_CLASS}
              >
                {STAGE_ACTION_LABEL[action]}
              </button>
            ))}
          </div>
        )}
      </div>

      {actions.length === 0 && !terminal && !notice && user.role !== "SUPERADMIN" && (
        <p className="text-sm text-ink/70">Tidak ada tindakan yang perlu kamu lakukan di tahap ini.</p>
      )}

      {notice?.tone === "success" && (
        <p key={notice.message} role="status" className="animate-pop-in rounded-xl bg-green/15 px-4 py-3 text-sm font-medium text-ink">
          {notice.message}
        </p>
      )}
      {notice?.tone === "error" && (
        <p key={notice.message} role="alert" className="animate-shake rounded-xl bg-red/10 px-4 py-3 text-sm font-medium text-wine">
          {notice.message}
        </p>
      )}

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
            <p className="mt-1 font-mono text-sm font-semibold wrap-break-word">{ticket.id}</p>
            <p id="stage-dialog-description" className="mt-3 text-sm text-ink/70">
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
                  <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-mist/40 border-t-mist" />
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
          onSubmit={(reason) => void run(reasonAction, reasonCopy.success, reason)}
          onClose={() => setReasonAction(null)}
        />
      )}
    </section>
  );
}

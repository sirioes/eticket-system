"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/layout/user-context";
import { CommentComposer } from "@/components/tickets/comment-composer";
import type { MessagesState } from "@/components/tickets/use-ticket-messages";
import { ApiError, errorMessage, isUnauthorized } from "@/lib/api";
import { DIVISI_LABEL, formatDateWita } from "@/lib/labels";
import { COMMENT_MAX_LENGTH } from "@/lib/ticket-rules";
import { postTicketMessage } from "@/lib/tickets";
import { useMobileLayout } from "@/lib/use-mobile-layout";
import { useVisualViewport } from "@/lib/use-visual-viewport";
import type { SessionUser } from "@/types/auth.types";
import type { ReasonLabel, TicketDetail, TicketMessage } from "@/types/ticket.types";

const STICK_TO_BOTTOM_PX = 48;

const REASON_BADGE: Record<ReasonLabel, { text: string; badge: string; block: string }> = {
  PENGAJUAN: { text: "Alasan pengajuan", badge: "bg-green text-ink", block: "bg-green/15" },
  MENERIMA: { text: "Alasan menerima", badge: "bg-green text-ink", block: "bg-green/15" },
  MENOLAK: { text: "Alasan menolak", badge: "bg-red text-mist", block: "bg-red/10" },
};

function isOwn(user: SessionUser, message: TicketMessage): boolean {
  return message.author.fullName === user.fullName && message.author.divisi === user.divisi;
}

function authorMeta(user: SessionUser, message: TicketMessage): string {
  const time = formatDateWita(message.createdAt);
  if (isOwn(user, message)) return `Anda · ${time}`;
  const divisi = message.author.divisi ? ` (${DIVISI_LABEL[message.author.divisi]})` : "";
  return `${message.author.fullName}${divisi} · ${time}`;
}

function closedNotice(ticket: TicketDetail): string {
  return ticket.stage === "DITOLAK"
    ? "Komentar ditutup karena pengaduan ditolak."
    : "Komentar ditutup karena pengaduan sudah selesai.";
}

function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter((part) => part !== "")
    .slice(0, 2)
    .map((part) => [...part][0].toUpperCase())
    .join("");
}

function MessageItem({
  user,
  message,
  grouped = false,
}: {
  user: SessionUser;
  message: TicketMessage;
  grouped?: boolean;
}) {
  const meta = authorMeta(user, message);

  if (message.kind === "ALASAN") {
    const reason = message.reasonLabel ? REASON_BADGE[message.reasonLabel] : null;
    return (
      <li className={`rounded-xl px-4 py-3 ${reason?.block ?? "bg-ink/5"}`}>
        {reason && (
          <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${reason.badge}`}>
            {reason.text}
          </span>
        )}
        <p className="mt-2 text-sm leading-relaxed whitespace-pre-line wrap-break-word">{message.body}</p>
        <p className="mt-2 text-xs text-ink/70">{meta}</p>
      </li>
    );
  }

  const own = isOwn(user, message);
  return (
    <li className={`flex items-end gap-2 ${own ? "justify-end" : "justify-start"} ${grouped ? "-mt-2" : ""}`}>
      {!own && (
        <span
          aria-hidden="true"
          className={`grid size-8 shrink-0 place-items-center rounded-full bg-teal text-xs font-semibold text-mist ${grouped ? "invisible" : ""}`}
        >
          {initials(message.author.fullName)}
        </span>
      )}
      <div className={`flex min-w-0 max-w-[85%] flex-col ${own ? "items-end" : "items-start"}`}>
        {!grouped && <p className="mb-1 text-xs text-ink/70">{meta}</p>}
        <div className={`rounded-2xl px-4 py-2.5 ${own ? "bg-teal text-mist" : "border border-ink/15 bg-mist"}`}>
          <p className="text-sm leading-relaxed whitespace-pre-line wrap-break-word">{message.body}</p>
        </div>
      </div>
    </li>
  );
}

function sameSender(a: TicketMessage | undefined, b: TicketMessage): boolean {
  return (
    a !== undefined &&
    a.kind === "KOMENTAR" &&
    b.kind === "KOMENTAR" &&
    a.author.fullName === b.author.fullName &&
    a.author.divisi === b.author.divisi
  );
}

interface TicketCommentsProps {
  ticket: TicketDetail;
  messages: MessagesState;
  active: boolean;
  onSent: () => void;
  onChanged: () => void;
  onBack: () => void;
}

export function TicketComments({ ticket, messages: state, active, onSent, onChanged, onBack }: TicketCommentsProps) {
  const router = useRouter();
  const user = useUser();
  const mobile = useMobileLayout();
  const overlay = mobile && active;
  const viewport = useVisualViewport(overlay);
  const listRef = useRef<HTMLUListElement>(null);
  const stickRef = useRef(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const ticketId = ticket.id;
  const all = state.status === "ready" ? state.messages : null;
  const pinned = all?.find((message) => message.reasonLabel === "PENGAJUAN") ?? null;
  const messages = all && all.filter((message) => message !== pinned);
  const lastId = messages && messages.length > 0 ? messages[messages.length - 1].id : null;
  const ready = all !== null;
  const isSuperadmin = user.role === "SUPERADMIN";

  useEffect(() => {
    const list = listRef.current;
    if (list && active && stickRef.current) list.scrollTop = list.scrollHeight;
  }, [lastId, active, ready, mobile]);

  useEffect(() => {
    if (!overlay) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [overlay]);

  function trackScroll() {
    const list = listRef.current;
    if (list) stickRef.current = list.scrollHeight - list.scrollTop - list.clientHeight <= STICK_TO_BOTTOM_PX;
  }

  async function send() {
    const body = draft.trim();
    if (sending || body === "" || [...body].length > COMMENT_MAX_LENGTH) return;
    setSending(true);
    setSendError(null);
    try {
      await postTicketMessage(ticketId, body);
      setDraft("");
      stickRef.current = true;
      onSent();
    } catch (caught) {
      if (isUnauthorized(caught)) {
        router.replace("/login?reason=expired");
        return;
      }
      setSendError(errorMessage(caught));
      if (caught instanceof ApiError && (caught.status === 404 || caught.status === 409)) onChanged();
    } finally {
      setSending(false);
    }
  }

  const heading = mobile ? (
    <div className="flex items-center gap-2 border-b border-ink/10 pb-2">
      <button
        type="button"
        onClick={onBack}
        aria-label="Kembali ke detail pengaduan"
        className="grid size-10 shrink-0 place-items-center rounded-xl text-teal transition-[background-color,transform] duration-200 ease-spring hover:bg-ink/5 active:scale-95"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <h2 className="text-lg font-semibold">Komentar</h2>
    </div>
  ) : (
    <h2 className="text-lg font-semibold">Komentar</h2>
  );

  const listHeight = mobile ? "min-h-0 flex-1" : "h-130";

  const body = (
    <>
      {heading}

      {state.status === "loading" && (
        <div className={`grid place-items-center ${listHeight}`}>
          <span
            role="status"
            aria-label="Memuat komentar"
            className="size-6 animate-spin rounded-full border-3 border-teal/20 border-t-teal"
          />
        </div>
      )}
      {state.status === "error" && (
        <p role="alert" className="rounded-xl bg-red/10 px-4 py-3 text-sm font-medium text-wine">
          {state.message}
        </p>
      )}
      {state.status === "ready" && state.stale && (
        <p role="status" className="rounded-xl bg-ink/5 px-4 py-2 text-sm text-ink/70">
          Gagal memperbarui komentar. Daftar di bawah mungkin belum yang terbaru.
        </p>
      )}
      {messages && (
        <ul
          ref={listRef}
          aria-label="Daftar komentar"
          onScroll={trackScroll}
          className={`scroll-pill flex flex-col gap-4 overflow-y-auto overscroll-contain rounded-2xl bg-ink/5 p-4 sm:p-5 ${listHeight}`}
        >
          {pinned && <MessageItem user={user} message={pinned} />}
          {messages.length === 0 && <li className="py-6 text-center text-sm text-ink/70">Belum ada komentar.</li>}
          {messages.map((message, index) => (
            <MessageItem
              key={message.id}
              user={user}
              message={message}
              grouped={sameSender(messages[index - 1], message)}
            />
          ))}
        </ul>
      )}

      {!isSuperadmin && (
        <CommentComposer
          draft={draft}
          sending={sending}
          error={sendError}
          closedNotice={ticket.canComment ? null : closedNotice(ticket)}
          onDraftChange={setDraft}
          onSubmit={() => void send()}
        />
      )}
    </>
  );

  if (!mobile) return <div className="flex flex-col gap-4">{body}</div>;
  if (!active) return null;

  return createPortal(
    <div
      style={viewport ? ({ "--vvh": `${viewport.height}px`, "--vvt": `${viewport.offsetTop}px` } as CSSProperties) : undefined}
      className="fixed inset-x-0 top-[var(--vvt,0px)] z-50 flex h-[var(--vvh,100dvh)] flex-col gap-3 bg-mist px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(1.75rem,env(safe-area-inset-bottom))]"
    >
      {body}
    </div>,
    document.body,
  );
}

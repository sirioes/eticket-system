"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/layout/user-context";
import { CARD_CLASS } from "@/components/ui/card-class";
import { ApiError, errorMessage, isUnauthorized } from "@/lib/api";
import { DIVISI_LABEL, formatDateWita } from "@/lib/labels";
import { COMMENT_MAX_LENGTH } from "@/lib/ticket-rules";
import { listTicketMessages, postTicketMessage } from "@/lib/tickets";
import type { SessionUser } from "@/types/auth.types";
import type { ReasonLabel, TicketDetail, TicketMessage } from "@/types/ticket.types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; messages: TicketMessage[] };

const POLL_INTERVAL_MS = 10_000;

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
    ? "Komentar ditutup karena pengaduan sudah ditolak. Riwayat komentar tetap dapat dibaca."
    : "Komentar ditutup karena pengaduan sudah selesai. Riwayat komentar tetap dapat dibaca.";
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
        <div className={`rounded-2xl px-4 py-2.5 ${own ? "bg-teal/15" : "bg-ink/5"}`}>
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
  onChanged: () => void;
}

export function TicketComments({ ticket, onChanged }: TicketCommentsProps) {
  const router = useRouter();
  const user = useUser();
  const titleId = useId();
  const fieldId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const [tick, setTick] = useState(0);
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const ticketId = ticket.id;
  const requestKey = `${ticketId}#${tick}`;
  const all = load.status === "ready" ? load.messages : null;
  const pinned = all?.find((message) => message.reasonLabel === "PENGAJUAN") ?? null;
  const messages = all && all.filter((message) => message !== pinned);
  const lastId = messages && messages.length > 0 ? messages[messages.length - 1].id : null;
  const canCompose = ticket.canComment;
  const isSuperadmin = user.role === "SUPERADMIN";
  const trimmedLength = [...draft.trim()].length;

  useEffect(() => {
    let active = true;
    listTicketMessages(ticketId)
      .then((data) => {
        if (active) setLoad({ status: "ready", messages: data });
      })
      .catch((caught: unknown) => {
        if (!active) return;
        if (isUnauthorized(caught)) {
          router.replace("/login?reason=expired");
          return;
        }
        setLoad((previous) =>
          previous.status === "ready" ? previous : { status: "error", message: errorMessage(caught) },
        );
      });
    return () => {
      active = false;
    };
  }, [ticketId, requestKey, router]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setTick((value) => value + 1);
    };
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [lastId]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || expanded) return;
    const observer = new ResizeObserver(() => setOverflowing(list.scrollHeight > list.clientHeight + 1));
    observer.observe(list);
    return () => observer.disconnect();
  }, [lastId, expanded]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (sending || body === "" || trimmedLength > COMMENT_MAX_LENGTH) return;
    setSending(true);
    setSendError(null);
    try {
      await postTicketMessage(ticketId, body);
      setDraft("");
      setTick((value) => value + 1);
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

  return (
    <section
      aria-labelledby={titleId}
      className={`${CARD_CLASS} flex animate-fade-up flex-col gap-4 [animation-delay:100ms]`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-lg font-semibold">
          Komentar
        </h2>
        {(expanded || overflowing) && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
            className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-teal transition-colors duration-200 hover:bg-teal/10"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d={expanded ? "M6 14l6-6 6 6" : "M6 10l6 6 6-6"} />
            </svg>
            {expanded ? "Perkecil" : "Perbesar"}
          </button>
        )}
      </div>

      {pinned && (
        <ul aria-label="Alasan pengajuan" className="shrink-0">
          <MessageItem user={user} message={pinned} />
        </ul>
      )}

      <div className="shrink-0">
        {load.status === "loading" && (
          <div className="grid place-items-center py-6">
            <span
              role="status"
              aria-label="Memuat komentar"
              className="size-6 animate-spin rounded-full border-3 border-teal/20 border-t-teal"
            />
          </div>
        )}
        {load.status === "error" && (
          <p role="alert" className="rounded-xl bg-red/10 px-4 py-3 text-sm font-medium text-wine">
            {load.message}
          </p>
        )}
        {messages && messages.length === 0 && (
          <p className="py-6 text-center text-sm text-ink/70">Belum ada komentar.</p>
        )}
        {messages && messages.length > 0 && (
          <ul
            ref={listRef}
            aria-label="Daftar komentar"
            className={`scroll-pill flex flex-col gap-3 overflow-y-auto pr-1 ${expanded ? "max-h-[min(34rem,70dvh)]" : "max-h-56"}`}
          >
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
      </div>

      {canCompose && (
        <form onSubmit={send} className="flex flex-col gap-1.5 border-t border-ink/10 pt-3">
          <label htmlFor={fieldId} className="sr-only">
            Komentar
          </label>
          <div className="flex items-end gap-2 rounded-xl border border-ink/15 bg-ink/5 p-1.5 transition-[border-color,box-shadow] duration-200 ease-smooth focus-within:border-teal focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-teal)_18%,transparent)]">
            <textarea
              id={fieldId}
              value={draft}
              maxLength={COMMENT_MAX_LENGTH}
              disabled={sending}
              rows={1}
              placeholder="Tulis komentar…"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              className="scroll-pill field-sizing-content max-h-28 min-h-8 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={sending || trimmedLength === 0}
              aria-busy={sending}
              className="flex h-8 shrink-0 items-center justify-center gap-2 rounded-lg bg-teal px-4 text-sm font-semibold text-mist transition-[background-color,transform] duration-200 ease-smooth hover:bg-ink active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending && (
                <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-mist/40 border-t-mist" />
              )}
              {sending ? "Mengirim…" : "Kirim"}
            </button>
          </div>
          {sendError && (
            <p key={sendError} role="alert" className="animate-shake text-sm font-medium text-wine">
              {sendError}
            </p>
          )}
          <p className="text-xs text-ink/70">Komentar tidak dapat diubah atau dihapus setelah dikirim.</p>
        </form>
      )}

      {!canCompose && !isSuperadmin && (
        <p className="border-t border-ink/10 pt-4 text-sm text-ink/70">{closedNotice(ticket)}</p>
      )}
    </section>
  );
}

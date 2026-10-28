"use client";

import type { FormEvent } from "react";
import { COMMENT_MAX_LENGTH } from "@/lib/ticket-rules";
import { useCoarsePointer } from "@/lib/use-coarse-pointer";

const SEND_ICON_PATH = "M22 2 11 13M22 2l-7 20-4-9-9-4z";

const PILL_CLASS = "flex min-h-13 gap-2 rounded-[26px] border py-2 pr-2 pl-5";

function SendIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={SEND_ICON_PATH} />
    </svg>
  );
}

interface CommentComposerProps {
  draft: string;
  sending: boolean;
  error: string | null;
  closedNotice: string | null;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
}

export function CommentComposer({
  draft,
  sending,
  error,
  closedNotice,
  onDraftChange,
  onSubmit,
}: CommentComposerProps) {
  const coarsePointer = useCoarsePointer();

  if (closedNotice !== null) {
    return (
      <div className={`${PILL_CLASS} items-center border-ink/10 bg-ink/10 text-ink/70`}>
        <p className="min-w-0 flex-1 text-sm">{closedNotice}</p>
        <button
          type="button"
          disabled
          aria-label="Kirim komentar"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-ink/20 text-mist disabled:cursor-not-allowed"
        >
          <SendIcon />
        </button>
      </div>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <div
        className={`${PILL_CLASS} items-end border-ink/20 bg-mist transition-[border-color,box-shadow] duration-200 ease-smooth focus-within:border-teal focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-teal)_18%,transparent)]`}
      >
        <textarea
          aria-label="Komentar"
          value={draft}
          maxLength={COMMENT_MAX_LENGTH}
          readOnly={sending}
          rows={1}
          placeholder="Tulis komentar…"
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !coarsePointer) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          className="scroll-pill field-sizing-content max-h-24 min-h-9 min-w-0 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-ink/50"
        />
        <button
          type="submit"
          disabled={sending || draft.trim() === ""}
          aria-busy={sending}
          aria-label="Kirim komentar"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-teal text-mist transition-[background-color,transform] duration-200 ease-smooth hover:bg-ink active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? (
            <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-mist/40 border-t-mist" />
          ) : (
            <SendIcon />
          )}
        </button>
      </div>
      {error && (
        <p key={error} role="alert" className="animate-shake text-sm font-medium text-wine">
          {error}
        </p>
      )}
    </form>
  );
}

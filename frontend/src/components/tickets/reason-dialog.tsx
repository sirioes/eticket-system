"use client";

import { useId, useState, type FormEvent } from "react";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { TEXTAREA_CLASS } from "@/components/ui/input-class";
import { REASON_MAX_LENGTH, REASON_MIN_LENGTH } from "@/lib/ticket-rules";

export type ReasonAction = "TERIMA" | "TOLAK";

interface ReasonDialogProps {
  action: ReasonAction;
  ticketId: string;
  title: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  onSubmit: (reason: string) => void;
  onClose: () => void;
}

const FIELD_LABEL: Record<ReasonAction, string> = {
  TERIMA: "Alasan menerima",
  TOLAK: "Alasan menolak",
};

const CONFIRM_CLASS: Record<ReasonAction, string> = {
  TERIMA: "bg-teal hover:bg-ink",
  TOLAK: "bg-red hover:bg-berry",
};

export function ReasonDialog({
  action,
  ticketId,
  title,
  description,
  confirmLabel,
  busy,
  onSubmit,
  onClose,
}: ReasonDialogProps) {
  const titleId = useId();
  const fieldId = useId();
  const hintId = useId();
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  const length = [...value.trim()].length;
  const tooShort = length < REASON_MIN_LENGTH;
  const valid = !tooShort && length <= REASON_MAX_LENGTH;
  const showError = touched && tooShort;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || busy) return;
    onSubmit(value.trim());
  }

  return (
    <ModalDialog titleId={titleId} busy={busy} onClose={onClose}>
      <form onSubmit={submit} className="p-6" noValidate>
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <p className="mt-1 font-mono text-sm font-semibold wrap-break-word">{ticketId}</p>
        <p className="mt-3 text-sm text-ink/70">{description}</p>

        <label htmlFor={fieldId} className="mt-5 block text-sm font-medium">
          {FIELD_LABEL[action]}
        </label>
        <textarea
          id={fieldId}
          autoFocus
          value={value}
          maxLength={REASON_MAX_LENGTH}
          disabled={busy}
          aria-invalid={showError}
          aria-describedby={hintId}
          onChange={(event) => {
            setValue(event.target.value);
            setTouched(true);
          }}
          onBlur={() => setTouched(true)}
          className={`${TEXTAREA_CLASS} scroll-pill mt-2 min-h-32`}
        />
        <div id={hintId} className="mt-2 flex items-start justify-between gap-3 text-sm">
          {showError ? (
            <p role="alert" className="font-medium text-wine">
              Alasan minimal {REASON_MIN_LENGTH} karakter.
            </p>
          ) : (
            <span />
          )}
          <span className="shrink-0 font-mono text-xs text-ink/70">
            {length}/{REASON_MAX_LENGTH}
          </span>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-11 rounded-xl border border-ink/15 px-5 text-sm font-semibold text-ink transition-colors duration-200 hover:bg-ink/5 disabled:opacity-60"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={!valid || busy}
            aria-busy={busy}
            className={`flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-mist transition-[background-color,transform] duration-200 ease-spring active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${CONFIRM_CLASS[action]}`}
          >
            {busy && (
              <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-mist/40 border-t-mist" />
            )}
            {busy ? "Menyimpan…" : confirmLabel}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}

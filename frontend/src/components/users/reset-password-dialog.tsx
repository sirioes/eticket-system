"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { PasswordInput } from "@/components/ui/password-input";
import {
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@/components/ui/button-class";
import { errorMessage, isUnauthorized } from "@/lib/api";
import { MIN_PASSWORD_LENGTH } from "@/lib/user-rules";
import { resetUserPassword } from "@/lib/users";
import type { ManagedUser } from "@/types/user.types";

interface ResetPasswordDialogProps {
  user: ManagedUser;
  onClose: () => void;
  onDone: (user: ManagedUser) => void;
}

export function ResetPasswordDialog({
  user,
  onClose,
  onDone,
}: ResetPasswordDialogProps) {
  const router = useRouter();
  const ids = useId();
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; tick: number } | null>(
    null,
  );

  function fail(text: string, field?: HTMLInputElement | null) {
    setError((current) => ({ text, tick: (current?.tick ?? 0) + 1 }));
    field?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const password = passwordRef.current?.value ?? "";
    const confirmation = confirmRef.current?.value ?? "";
    if (password.length < MIN_PASSWORD_LENGTH)
      return fail(
        `Password baru minimal ${MIN_PASSWORD_LENGTH} karakter.`,
        passwordRef.current,
      );
    if (password !== confirmation)
      return fail("Konfirmasi password tidak cocok.", confirmRef.current);

    setBusy(true);
    setError(null);
    try {
      await resetUserPassword(user.id, password);
      onDone(user);
    } catch (caught) {
      if (isUnauthorized(caught)) {
        router.replace("/login?reason=expired");
        return;
      }
      fail(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <ModalDialog titleId={`${ids}-title`} busy={busy} onClose={onClose}>
      <form
        method="post"
        noValidate
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 p-6 sm:p-8"
      >
        <div>
          <p className="font-mono text-xs font-medium tracking-[0.2em] text-teal uppercase">
            Keamanan akun
          </p>
          <h2
            id={`${ids}-title`}
            className="mt-1 text-xl font-semibold tracking-tight"
          >
            Reset password
          </h2>
          <p className="mt-2 text-sm text-ink/70">
            Atur password baru untuk{" "}
            <span className="font-semibold text-ink wrap-break-word">
              {user.fullName}
            </span>
            . Sesi akun ini langsung keluar, lalu pengguna perlu masuk dengan
            password baru.
          </p>
        </div>

        {error && (
          <p
            key={error.tick}
            role="alert"
            className="animate-shake rounded-xl bg-red/10 px-4 py-3 text-sm font-medium text-wine"
          >
            {error.text}
          </p>
        )}

        <PasswordInput
          ref={passwordRef}
          id={`${ids}-password`}
          label="Password baru"
          autoComplete="new-password"
          disabled={busy}
          invalid={false}
          className="animate-fade-up"
        />
        <PasswordInput
          ref={confirmRef}
          id={`${ids}-confirm`}
          label="Konfirmasi password baru"
          autoComplete="new-password"
          disabled={busy}
          invalid={false}
          className="animate-fade-up [animation-delay:60ms]"
        />

        <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={SECONDARY_BUTTON_CLASS}
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className={PRIMARY_BUTTON_CLASS}
          >
            {busy && (
              <span
                aria-hidden="true"
                className="size-4 animate-spin rounded-full border-2 border-mist/40 border-t-mist"
              />
            )}
            {busy ? "Menyimpan…" : "Reset password"}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}

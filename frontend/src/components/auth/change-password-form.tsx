"use client";

import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/ui/password-input";
import { errorMessage, isUnauthorized } from "@/lib/api";
import { changePassword } from "@/lib/session";

interface Notice {
  tone: "error" | "success";
  text: string;
}

type FieldRef = RefObject<HTMLInputElement | null>;

export function ChangePasswordForm() {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const focusRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [attempt, setAttempt] = useState(0);

  const failed = notice?.tone === "error";
  const saved = notice?.tone === "success";

  useEffect(() => {
    if (attempt === 0) return;
    const card = cardRef.current;
    card?.classList.remove("animate-shake");
    void card?.offsetWidth;
    card?.classList.add("animate-shake");
    focusRef.current?.focus();
  }, [attempt]);

  function fail(text: string, field?: FieldRef) {
    focusRef.current = field?.current ?? null;
    setNotice({ tone: "error", text });
    setAttempt((value) => value + 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const currentPassword = currentRef.current?.value ?? "";
    const newPassword = newRef.current?.value ?? "";
    const confirmPassword = confirmRef.current?.value ?? "";

    const emptyField = [currentRef, newRef, confirmRef].find(
      (field) => field.current?.value === "",
    );
    if (emptyField) return fail("Isi semua kolom password.", emptyField);
    if (newPassword !== confirmPassword)
      return fail("Konfirmasi password baru tidak cocok.", confirmRef);

    setBusy(true);
    setNotice(null);
    try {
      await changePassword({ currentPassword, newPassword });
      form.reset();
      setNotice({
        tone: "success",
        text: "Password berhasil diganti. Sesi di perangkat lain otomatis keluar.",
      });
    } catch (caught) {
      if (isUnauthorized(caught)) {
        router.replace("/login?reason=expired");
        return;
      }
      fail(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 max-w-lg animate-fade-up [animation-delay:80ms]">
      <div
        ref={cardRef}
        className="rounded-3xl bg-mist p-6 shadow-[0_24px_60px_-28px_color-mix(in_oklab,var(--color-ink)_35%,transparent)] sm:p-8"
      >
        <div className="flex items-center gap-4">
          <span
            key={saved ? "saved" : "locked"}
            aria-hidden="true"
            className={`grid size-12 shrink-0 animate-pop-in place-items-center rounded-2xl ${saved ? "bg-green text-mist" : "bg-teal/10 text-teal"}`}
          >
            <svg
              viewBox="0 0 24 24"
              className="size-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {saved ? (
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              ) : (
                <>
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </>
              )}
            </svg>
          </span>
          <div>
            <p className="font-mono text-xs font-medium tracking-[0.2em] text-teal uppercase">
              Keamanan akun
            </p>
            <p className="mt-0.5 text-sm text-ink/60">
              Masukkan password lama, lalu buat password baru.
            </p>
          </div>
        </div>

        <form
          method="post"
          noValidate
          onSubmit={handleSubmit}
          className="mt-6 flex flex-col gap-5"
        >
          {notice && (
            <p
              role={failed ? "alert" : "status"}
              className={`animate-fade-in rounded-xl px-4 py-3 text-sm font-medium ${failed ? "bg-red/10 text-red" : "bg-green/15 text-teal"}`}
            >
              {notice.text}
            </p>
          )}

          <PasswordInput
            ref={currentRef}
            id="currentPassword"
            label="Password lama"
            autoComplete="current-password"
            disabled={busy}
            invalid={failed}
            className="animate-fade-up [animation-delay:140ms]"
          />
          <PasswordInput
            ref={newRef}
            id="newPassword"
            label="Password baru"
            autoComplete="new-password"
            disabled={busy}
            invalid={failed}
            className="animate-fade-up [animation-delay:200ms]"
          />
          <PasswordInput
            ref={confirmRef}
            id="confirmPassword"
            label="Konfirmasi password baru"
            autoComplete="new-password"
            disabled={busy}
            invalid={failed}
            className="animate-fade-up [animation-delay:260ms]"
          />

          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className="mt-1 flex h-12 animate-fade-up items-center justify-center gap-2 rounded-xl bg-teal font-semibold text-mist transition-[background-color,transform] duration-200 ease-smooth [animation-delay:320ms] hover:bg-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80"
          >
            {busy && (
              <span
                aria-hidden="true"
                className="size-4 animate-spin rounded-full border-2 border-mist/40 border-t-mist"
              />
            )}
            {busy ? "Menyimpan…" : "Simpan password"}
          </button>

          <p className="animate-fade-in text-center text-xs text-ink/60 [animation-delay:380ms]">
            Minimal 8 karakter dan harus berbeda dari password lama.
          </p>
        </form>
      </div>
    </div>
  );
}
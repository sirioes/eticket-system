"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { INPUT_CLASS } from "@/components/ui/input-class";
import { PasswordInput } from "@/components/ui/password-input";
import { errorMessage } from "@/lib/api";
import { login } from "@/lib/session";

type Status = "idle" | "submitting" | "success";

const REDIRECT_DELAY_MS = 700;

const BUTTON_LABEL: Record<Status, string> = {
  idle: "Masuk",
  submitting: "Memeriksa…",
  success: "Berhasil masuk",
};

export function LoginForm({
  expired,
  focusSignal,
}: {
  expired: boolean;
  focusSignal: number;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fullNameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const busy = status !== "idle";

  useEffect(() => {
    if (focusSignal > 0) fullNameRef.current?.focus({ preventScroll: true });
  }, [focusSignal]);

  useEffect(() => {
    if (attempt === 0) return;
    const form = formRef.current;
    form?.classList.remove("animate-shake");
    void form?.offsetWidth;
    form?.classList.add("animate-shake");
    const nameEmpty = fullNameRef.current?.value.trim() === "";
    (nameEmpty ? fullNameRef : passwordRef).current?.focus();
  }, [attempt]);

  function fail(message: string) {
    setError(message);
    setStatus("idle");
    setAttempt((value) => value + 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("fullName") ?? "");
    const password = String(form.get("password") ?? "");
    if (fullName.trim() === "" || password === "")
      return fail("Isi username dan password.");

    setStatus("submitting");
    setError(null);
    try {
      await login({ fullName, password });
      setStatus("success");
      window.setTimeout(() => router.replace("/"), REDIRECT_DELAY_MS);
    } catch (caught) {
      if (passwordRef.current) passwordRef.current.value = "";
      fail(errorMessage(caught));
    }
  }

  return (
    <form
      ref={formRef}
      method="post"
      noValidate
      onSubmit={handleSubmit}
      className="mt-6 flex flex-col gap-4.5"
    >
      {error !== null ? (
        <p
          role="alert"
          className="animate-fade-in rounded-xl bg-red/10 px-4 py-3 text-sm font-medium text-red"
        >
          {error}
        </p>
      ) : (
        expired && (
          <p
            role="status"
            className="animate-fade-in rounded-xl bg-aqua/25 px-4 py-3 text-sm font-medium"
          >
            Sesi berakhir. Silakan masuk lagi.
          </p>
        )
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="fullName" className="text-[13px] font-semibold">
          Username
        </label>
        <input
          ref={fullNameRef}
          id="fullName"
          name="fullName"
          autoComplete="username"
          autoCapitalize="words"
          spellCheck={false}
          maxLength={191}
          disabled={busy}
          aria-invalid={error !== null}
          className={INPUT_CLASS}
        />
      </div>

      <PasswordInput
        ref={passwordRef}
        id="password"
        label="Password"
        autoComplete="current-password"
        disabled={busy}
        invalid={error !== null}
      />

      <button
        type="submit"
        disabled={busy}
        aria-busy={status === "submitting"}
        className={`mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full font-semibold transition-[background-color,transform] duration-200 ease-smooth active:scale-[0.98] disabled:cursor-not-allowed ${
          status === "success"
            ? "bg-green text-ink"
            : "bg-teal text-mist hover:bg-ink"
        }`}
      >
        {status === "submitting" && (
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-mist/40 border-t-mist"
          />
        )}
        {status === "success" && (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-5 animate-pop-in"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        )}
        {BUTTON_LABEL[status]}
      </button>

      <p className="text-center text-[13px] text-ink/65">
        Lupa password? Hubungi <b className="font-semibold text-ink">Tim IT</b>.
      </p>
    </form>
  );
}

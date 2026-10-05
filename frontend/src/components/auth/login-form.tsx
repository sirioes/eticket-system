"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
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
  children,
}: {
  expired: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const ticketRef = useRef<HTMLDivElement>(null);
  const fullNameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const busy = status !== "idle";

  useEffect(() => {
    if (attempt === 0) return;
    const ticket = ticketRef.current;
    ticket?.classList.remove("animate-shake");
    void ticket?.offsetWidth;
    ticket?.classList.add("animate-shake");
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
    <div className="w-full max-w-md animate-fade-up lg:max-w-4xl">
      <div
        ref={ticketRef}
        className="relative flex flex-col overflow-hidden rounded-3xl shadow-[0_30px_80px_-24px_color-mix(in_oklab,var(--color-ink)_35%,transparent)] lg:flex-row"
      >
        <section className="flex flex-col bg-teal px-6 pt-7 pb-6 text-mist sm:px-8 lg:w-5/12 lg:p-10">
          {children}
        </section>

        <div
          aria-hidden="true"
          className="relative h-6 bg-mist lg:h-auto lg:w-6"
        >
          <span className="absolute -top-3 -left-3 size-6 rounded-full bg-haze" />
          <span className="absolute -top-3 -right-3 size-6 rounded-full bg-haze lg:top-auto lg:right-auto lg:-bottom-3 lg:-left-3" />
          <span className="absolute inset-x-5 top-0 border-t-2 border-dashed border-teal/40 lg:inset-x-auto lg:inset-y-6 lg:left-0 lg:border-t-0 lg:border-l-2" />
        </div>

        <div className="flex-1 bg-mist text-ink lg:py-4 lg:pr-4">
          <header className="flex items-start justify-between gap-4 px-6 pt-2 pb-1 sm:px-8 lg:pt-8">
            <div>
              <p className="font-mono text-xs font-medium tracking-[0.2em] text-teal uppercase">
                Tiket masuk
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                Masuk ke akunmu
              </h2>
            </div>
            {status === "success" && (
              <span
                aria-hidden="true"
                className="-rotate-12 animate-pop-in rounded-md border-2 border-teal px-2 py-1 font-mono text-xs font-bold tracking-[0.15em] text-teal uppercase"
              >
                Berhasil
              </span>
            )}
          </header>

          <form
            method="post"
            noValidate
            onSubmit={handleSubmit}
            className="flex flex-col gap-5 px-6 pt-5 pb-6 sm:px-8 sm:pb-8"
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
                  className="animate-fade-in rounded-xl bg-yellow/70 px-4 py-3 text-sm font-medium"
                >
                  Sesi berakhir. Silakan masuk lagi.
                </p>
              )
            )}

            <div className="flex animate-fade-up flex-col gap-2 [animation-delay:160ms]">
              <label htmlFor="fullName" className="text-sm font-medium">
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
              className="animate-fade-up [animation-delay:220ms]"
            />

            <button
              type="submit"
              disabled={busy}
              aria-busy={status === "submitting"}
              className={`mt-1 flex h-12 animate-fade-up items-center justify-center gap-2 rounded-xl font-semibold transition-[background-color,transform] duration-200 ease-smooth [animation-delay:280ms] active:scale-[0.98] disabled:cursor-not-allowed ${
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

            <p className="animate-fade-in text-center text-xs text-ink/60 [animation-delay:360ms]">
              Lupa password? Hubungi Tim IT untuk mereset akunmu.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
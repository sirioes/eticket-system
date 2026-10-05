"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/session";

export function LogoutButton() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  function close() {
    if (!busy) dialogRef.current?.close();
  }

  async function confirm() {
    setBusy(true);
    setFailed(false);
    try {
      await logout();
      router.replace("/login");
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFailed(false);
          dialogRef.current?.showModal();
        }}
        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-mist/80 transition-colors duration-200 hover:bg-mist/10 hover:text-mist lg:rounded-r-none"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />
        </svg>
        Keluar
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="logout-title"
        onCancel={(event) => busy && event.preventDefault()}
        onClick={(event) => event.target === event.currentTarget && close()}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-mist text-ink shadow-[0_30px_80px_-24px_color-mix(in_oklab,var(--color-ink)_60%,transparent)] backdrop:bg-ink/40 backdrop:backdrop-blur-sm open:animate-pop-in"
      >
        <div className="p-6">
          <h2 id="logout-title" className="text-lg font-semibold">
            Yakin ingin keluar?
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            Kamu perlu masuk lagi untuk membuka E-Ticket.
          </p>
          {failed && (
            <p
              role="alert"
              className="mt-4 animate-fade-in rounded-xl bg-red/10 px-4 py-3 text-sm font-medium text-red"
            >
              Gagal keluar. Periksa koneksi, lalu coba lagi.
            </p>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              autoFocus
              onClick={close}
              disabled={busy}
              className="h-11 rounded-xl px-5 text-sm font-semibold text-teal transition-colors duration-200 hover:bg-teal/10 disabled:opacity-60"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={busy}
              aria-busy={busy}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-red px-5 text-sm font-semibold text-mist transition-colors duration-200 hover:bg-berry disabled:cursor-not-allowed disabled:opacity-80"
            >
              {busy && (
                <span
                  aria-hidden="true"
                  className="size-4 animate-spin rounded-full border-2 border-mist/40 border-t-mist"
                />
              )}
              {busy ? "Keluar…" : "Keluar"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
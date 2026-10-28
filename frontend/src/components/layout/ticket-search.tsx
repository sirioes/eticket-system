"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FIELD_CLASS } from "@/components/ui/input-class";
import {
  isValidSearch,
  SEARCH_MAX_LENGTH,
  writeTicketListState,
} from "@/lib/ticket-list-params";

const SEARCH_ERROR = "ID hanya boleh berisi huruf, angka, dan tanda hubung.";

export function TicketSearch({ className = "" }: { className?: string }) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed === "") {
      setError(null);
      return;
    }
    if (!isValidSearch(trimmed)) {
      setError(SEARCH_ERROR);
      return;
    }
    setError(null);
    setValue("");
    const query = writeTicketListState({
      filters: { search: trimmed },
      page: 1,
    });
    router.push(`/daftar-pengaduan/keluar?${query}`);
  }

  return (
    <form role="search" onSubmit={submit} className={className}>
      <label htmlFor={`${id}-search`} className="sr-only">
        Cari nomor tiket
      </label>
      <div className="relative">
        <button
          type="submit"
          aria-label="Cari"
          className="absolute top-1/2 left-1 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-teal transition-[background-color,color,transform] duration-200 ease-spring hover:bg-teal hover:text-mist active:scale-90"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </button>
        <input
          id={`${id}-search`}
          type="search"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={SEARCH_MAX_LENGTH}
          placeholder="Cari nomor tiket…"
          value={value}
          aria-invalid={error !== null}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => setValue(event.target.value)}
          className={`h-10 pl-11 ${FIELD_CLASS}`}
        />
      </div>
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 animate-shake text-sm text-wine"
        >
          {error}
        </p>
      )}
    </form>
  );
}

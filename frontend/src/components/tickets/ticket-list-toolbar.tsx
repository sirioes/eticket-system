"use client";

import { useId, useState, type FormEvent } from "react";
import {
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@/components/ui/button-class";
import { INPUT_CLASS } from "@/components/ui/input-class";
import { DIVISI_LABEL, STAGE_FILTER_LABEL } from "@/lib/labels";
import {
  activeFilterCount,
  isValidDateRange,
  isValidSearch,
  SEARCH_MAX_LENGTH,
} from "@/lib/ticket-list-params";
import type { Divisi } from "@/types/auth.types";
import type { TicketListFilters, TicketStage } from "@/types/ticket.types";

const STAGES = Object.keys(STAGE_FILTER_LABEL) as TicketStage[];

const SEARCH_ERROR = "ID hanya boleh berisi huruf, angka, dan tanda hubung.";

const RANGE_ERROR = "Tanggal awal tidak boleh setelah tanggal akhir.";

const SELECT_CLASS = `${INPUT_CLASS} appearance-none pr-11`;

const LABEL_CLASS = "text-sm font-medium";

interface TicketListToolbarProps {
  filters: TicketListFilters;
  divisiOptions: Divisi[];
  divisiLabel: string;
  onApply: (filters: TicketListFilters) => void;
}

function Chevron() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-teal"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function orUndefined<T extends string>(value: T | ""): T | undefined {
  return value === "" ? undefined : value;
}

export function TicketListToolbar({
  filters,
  divisiOptions,
  divisiLabel,
  onApply,
}: TicketListToolbarProps) {
  const ids = useId();
  const activeCount = activeFilterCount(filters);
  const [open, setOpen] = useState(activeCount > 0);
  const [search, setSearch] = useState(filters.search ?? "");
  const [dateFrom, setDateFrom] = useState(filters.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(filters.dateTo ?? "");
  const [divisi, setDivisi] = useState<Divisi | "">(filters.divisi ?? "");
  const [status, setStatus] = useState<TicketStage | "">(filters.status ?? "");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = search.trim();
    if (!isValidSearch(trimmed)) {
      setSearchError(SEARCH_ERROR);
      return;
    }
    setSearchError(null);
    onApply({ ...filters, search: orUndefined(trimmed) });
  }

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const from = orUndefined(dateFrom);
    const to = orUndefined(dateTo);
    if (!isValidDateRange(from, to)) {
      setRangeError(RANGE_ERROR);
      return;
    }
    setRangeError(null);
    onApply({
      search: filters.search,
      dateFrom: from,
      dateTo: to,
      divisi: orUndefined(divisi),
      status: orUndefined(status),
    });
  }

  function resetFilters() {
    setDateFrom("");
    setDateTo("");
    setDivisi("");
    setStatus("");
    setRangeError(null);
    onApply({ search: filters.search });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <form
          role="search"
          onSubmit={submitSearch}
          className="flex flex-1 flex-col gap-2"
        >
          <label htmlFor={`${ids}-search`} className="sr-only">
            Cari ID pengaduan
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink/60"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                id={`${ids}-search`}
                type="search"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                maxLength={SEARCH_MAX_LENGTH}
                placeholder="Contoh: IT-2026"
                value={search}
                aria-invalid={searchError !== null}
                aria-describedby={
                  searchError ? `${ids}-search-error` : undefined
                }
                onChange={(event) => setSearch(event.target.value)}
                className={`${INPUT_CLASS} pl-12`}
              />
            </div>
            <button type="submit" className={PRIMARY_BUTTON_CLASS}>
              Cari
            </button>
          </div>
          {searchError && (
            <p
              id={`${ids}-search-error`}
              role="alert"
              className="animate-shake text-sm text-wine"
            >
              {searchError}
            </p>
          )}
        </form>

        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${ids}-panel`}
          onClick={() => setOpen((current) => !current)}
          className={`${SECONDARY_BUTTON_CLASS} border border-ink/15 bg-mist`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-5 text-teal"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          Filter
          {activeCount > 0 && (
            <span className="grid size-6 animate-pop-in place-items-center rounded-full bg-teal font-mono text-xs text-mist">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {open && (
        <form
          id={`${ids}-panel`}
          onSubmit={submitFilters}
          className="animate-fade-in rounded-2xl border border-ink/10 bg-haze/60 p-4 sm:p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <label htmlFor={`${ids}-from`} className={LABEL_CLASS}>
                Dari tanggal
              </label>
              <input
                id={`${ids}-from`}
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => setDateFrom(event.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor={`${ids}-to`} className={LABEL_CLASS}>
                Sampai tanggal
              </label>
              <input
                id={`${ids}-to`}
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => setDateTo(event.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor={`${ids}-divisi`} className={LABEL_CLASS}>
                {divisiLabel}
              </label>
              <div className="relative">
                <select
                  id={`${ids}-divisi`}
                  value={divisi}
                  onChange={(event) =>
                    setDivisi(event.target.value as Divisi | "")
                  }
                  className={SELECT_CLASS}
                >
                  <option value="">Semua divisi</option>
                  {divisiOptions.map((option) => (
                    <option key={option} value={option}>
                      {DIVISI_LABEL[option]}
                    </option>
                  ))}
                </select>
                <Chevron />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor={`${ids}-status`} className={LABEL_CLASS}>
                Status
              </label>
              <div className="relative">
                <select
                  id={`${ids}-status`}
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as TicketStage | "")
                  }
                  className={SELECT_CLASS}
                >
                  <option value="">Semua status</option>
                  {STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {STAGE_FILTER_LABEL[stage]}
                    </option>
                  ))}
                </select>
                <Chevron />
              </div>
            </div>
          </div>

          {rangeError && (
            <p role="alert" className="mt-4 animate-shake text-sm text-wine">
              {rangeError}
            </p>
          )}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={resetFilters}
              className={SECONDARY_BUTTON_CLASS}
            >
              Atur ulang
            </button>
            <button type="submit" className={PRIMARY_BUTTON_CLASS}>
              Terapkan filter
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

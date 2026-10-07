"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { INPUT_CLASS } from "@/components/ui/input-class";
import { DIVISI_LABEL } from "@/lib/labels";
import type { Divisi } from "@/types/auth.types";

interface DivisiDropdownProps {
  id: string;
  value: Divisi | "";
  options: Divisi[];
  disabled: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onChange: (divisi: Divisi) => void;
}

export function DivisiDropdown({
  id,
  value,
  options,
  disabled,
  triggerRef,
  onChange,
}: DivisiDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    const panel = panelRef.current;
    (panel?.querySelector<HTMLInputElement>("input:checked") ??
      panel?.querySelector<HTMLInputElement>("input"))?.focus();
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" || event.key === "Enter") {
      event.preventDefault();
      close();
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && !event.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className={`${INPUT_CLASS} flex items-center justify-between gap-3 text-left`}
      >
        <span className={value === "" ? "text-ink/50" : undefined}>
          {value === "" ? "Pilih divisi tujuan" : DIVISI_LABEL[value]}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`size-5 shrink-0 text-teal transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="radiogroup"
          aria-label="Divisi Tujuan"
          onKeyDown={handlePanelKeyDown}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 animate-fade-in overflow-y-auto rounded-xl border border-ink/15 bg-mist p-1 shadow-[0_16px_40px_-16px_color-mix(in_oklab,var(--color-ink)_45%,transparent)]"
        >
          {options.map((divisi) => (
            <label
              key={divisi}
              onClick={(event) => {
                if (event.detail === 0) return;
                onChange(divisi);
                close();
              }}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-200 hover:bg-teal/10 has-checked:font-semibold has-focus-visible:outline-2 has-focus-visible:outline-teal"
            >
              <input
                type="radio"
                name="toDivisi"
                value={divisi}
                checked={value === divisi}
                onChange={() => onChange(divisi)}
                className="size-5 shrink-0 accent-teal"
              />
              {DIVISI_LABEL[divisi]}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

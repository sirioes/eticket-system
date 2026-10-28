"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OUTLINE_BUTTON_CLASS } from "@/components/ui/button-class";
import { errorMessage, isUnauthorized } from "@/lib/api";
import { saveBlob } from "@/lib/download";
import { downloadOutgoingExport } from "@/lib/tickets";
import type { TicketListFilters } from "@/types/ticket.types";

const FALLBACK_FILE_NAME = "pengaduan-keluar.xlsx";

export function ExportButton({ filters }: { filters: TicketListFilters }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportTickets() {
    setBusy(true);
    setError(null);
    try {
      const file = await downloadOutgoingExport(filters);
      saveBlob(file.blob, file.fileName ?? FALLBACK_FILE_NAME);
    } catch (caught) {
      if (isUnauthorized(caught)) {
        router.replace("/login?reason=expired");
        return;
      }
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <button
        type="button"
        onClick={exportTickets}
        disabled={busy}
        aria-busy={busy}
        className={`${OUTLINE_BUTTON_CLASS} h-12 px-5 text-sm`}
      >
        {busy ? (
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-teal/30 border-t-teal"
          />
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
          </svg>
        )}
        {busy ? "Menyiapkan file…" : "Unduh Excel"}
      </button>
      {error && (
        <p
          role="alert"
          className="max-w-xs animate-shake text-sm text-wine sm:text-right"
        >
          {error}
        </p>
      )}
    </div>
  );
}

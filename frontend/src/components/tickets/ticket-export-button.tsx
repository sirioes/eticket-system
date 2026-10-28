"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { errorMessage, isUnauthorized } from "@/lib/api";
import { saveBlob } from "@/lib/download";
import { downloadTicketExport } from "@/lib/tickets";

interface TicketExportButtonProps {
  ticketId: string;
  disabled?: boolean;
  onError: (message: string) => void;
}

export function TicketExportButton({ ticketId, disabled = false, onError }: TicketExportButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function exportTicket() {
    if (busy) return;
    setBusy(true);
    try {
      const file = await downloadTicketExport(ticketId);
      saveBlob(file.blob, file.fileName ?? `${ticketId}.xlsx`);
    } catch (caught) {
      if (isUnauthorized(caught)) {
        router.replace("/login?reason=expired");
        return;
      }
      onError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={exportTicket}
      disabled={busy || disabled}
      aria-busy={busy}
      title="Unduh data pengaduan ini dalam format Excel"
      className="flex h-10 flex-1 items-center whitespace-nowrap justify-center gap-2 rounded-full border border-teal/40 bg-mist px-4 text-sm font-semibold text-teal transition-[background-color,color,transform] duration-200 ease-spring hover:bg-teal hover:text-mist active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
    >
      {busy ? (
        <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-teal/30 border-t-teal" />
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
        </svg>
      )}
      {busy ? "Menyiapkan file…" : "Unduh Tiket"}
    </button>
  );
}

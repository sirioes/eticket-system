import type { ReactNode } from "react";
import { StatusBadge } from "@/components/tickets/status-badge";
import { DIVISI_LABEL, formatDateWita } from "@/lib/labels";
import type { TicketDetail } from "@/types/ticket.types";

function InfoItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="font-mono text-xs tracking-[0.15em] text-ink/70 uppercase">{label}</dt>
      <dd className="font-medium wrap-break-word">{children}</dd>
    </div>
  );
}

export function TicketInfoPanel({ ticket }: { ticket: TicketDetail }) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">Informasi Pengaduan</h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:gap-6 xl:grid-cols-4">
        <InfoItem label="ID Pengaduan">
          <span className="font-mono text-sm">{ticket.id}</span>
        </InfoItem>
        <InfoItem label="Divisi asal">{DIVISI_LABEL[ticket.fromDivisi]}</InfoItem>
        <InfoItem label="Divisi tujuan">{DIVISI_LABEL[ticket.toDivisi]}</InfoItem>
        <InfoItem label="Status">
          <StatusBadge stage={ticket.stage} fromDivisi={ticket.fromDivisi} toDivisi={ticket.toDivisi} wrap />
        </InfoItem>
        <InfoItem label="Dibuat oleh">{ticket.createdBy.fullName}</InfoItem>
        <InfoItem label="Tanggal dibuat">
          <time dateTime={ticket.createdAt} className="font-mono text-sm">
            {formatDateWita(ticket.createdAt)}
          </time>
        </InfoItem>
      </dl>
      <div className="flex flex-col gap-2 border-t border-ink/10 pt-6">
        <h3 className="font-mono text-xs tracking-[0.15em] text-ink/70 uppercase">Keterangan</h3>
        <p className="scroll-pill max-h-32.5 overflow-y-auto pr-2 leading-relaxed whitespace-pre-wrap wrap-break-word">{ticket.description}</p>
      </div>
    </div>
  );
}

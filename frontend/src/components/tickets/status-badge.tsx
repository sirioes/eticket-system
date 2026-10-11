import { stageLabel } from "@/lib/labels";
import type { Divisi } from "@/types/auth.types";
import type { TicketStage } from "@/types/ticket.types";

const STAGE_STYLE: Record<TicketStage, string> = {
  MENUNGGU_MANAGER_ASAL: "bg-yellow text-ink",
  MENUNGGU_MANAGER_TUJUAN: "bg-yellow text-ink",
  MENUNGGU_STAF_TUJUAN: "bg-aqua text-ink",
  DIPROSES: "bg-teal text-mist",
  SELESAI: "bg-green text-ink",
  DITOLAK: "bg-red text-mist",
};

interface StatusBadgeProps {
  stage: TicketStage;
  fromDivisi: Divisi;
  toDivisi: Divisi;
  wrap?: boolean;
}

export function StatusBadge({ stage, fromDivisi, toDivisi, wrap = false }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex animate-pop-in items-center gap-1.5 px-3 py-1 text-xs font-semibold ${wrap ? "rounded-xl text-left leading-snug" : "rounded-full whitespace-nowrap"} ${STAGE_STYLE[stage]}`}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      {stageLabel({ stage, fromDivisi, toDivisi })}
    </span>
  );
}

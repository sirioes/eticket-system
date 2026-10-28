import { DIVISI_LABEL } from "@/lib/labels";
import type { TicketDetail, TicketStage, TicketTimelineEntry } from "@/types/ticket.types";

export type ProgressStepState = "done" | "rejected" | "current" | "upcoming" | "skipped";

export interface ProgressStep {
  title: string;
  state: ProgressStepState;
  note: string;
  entry: TicketTimelineEntry | null;
}

type ProgressTicket = Pick<
  TicketDetail,
  "stage" | "rejectedAtStage" | "fromDivisi" | "toDivisi" | "timeline"
>;

const PIPELINE: readonly (TicketStage | null)[] = [
  null,
  "MENUNGGU_MANAGER_ASAL",
  "MENUNGGU_MANAGER_TUJUAN",
  "MENUNGGU_STAF_TUJUAN",
  "DIPROSES",
];

const DONE_NOTE = ["Dikirim", "Disetujui", "Diterima", "Mulai diproses", "Diselesaikan"];

const CURRENT_NOTE = ["", "Menunggu persetujuan", "Menunggu persetujuan", "Menunggu diproses", "Sedang dikerjakan"];

function rejectedPosition(ticket: ProgressTicket): number {
  const stage =
    ticket.rejectedAtStage ??
    ticket.timeline.find((entry) => entry.action === "TOLAK")?.fromStage ??
    null;
  return stage === null ? 1 : Math.max(1, PIPELINE.indexOf(stage));
}

function currentPosition(ticket: ProgressTicket): number {
  if (ticket.stage === "SELESAI") return PIPELINE.length;
  if (ticket.stage === "DITOLAK") return rejectedPosition(ticket);
  return PIPELINE.indexOf(ticket.stage);
}

export function stageNumber(ticket: ProgressTicket): number {
  return currentPosition(ticket);
}

function stepState(index: number, position: number, rejected: boolean): ProgressStepState {
  if (index < position) return "done";
  if (index === position) return rejected ? "rejected" : "current";
  return rejected ? "skipped" : "upcoming";
}

function stepNote(index: number, state: ProgressStepState): string {
  switch (state) {
    case "done":
      return DONE_NOTE[index];
    case "rejected":
      return "Ditolak";
    case "current":
      return CURRENT_NOTE[index];
    case "skipped":
      return "Tidak dilanjutkan";
    default:
      return "Belum dimulai";
  }
}

export function ticketProgress(ticket: ProgressTicket): ProgressStep[] {
  const titles = [
    "Dibuat",
    `Manajer ${DIVISI_LABEL[ticket.fromDivisi]}`,
    `Manajer ${DIVISI_LABEL[ticket.toDivisi]}`,
    "Diproses",
    "Selesai",
  ];
  const rejected = ticket.stage === "DITOLAK";
  const position = currentPosition(ticket);

  return PIPELINE.map((fromStage, index) => {
    const state = stepState(index, position, rejected);
    const reached = state === "done" || state === "rejected";
    return {
      title: titles[index],
      state,
      note: stepNote(index, state),
      entry: reached
        ? (ticket.timeline.find((entry) => entry.fromStage === fromStage) ?? null)
        : null,
    };
  });
}

export function stageSummary(ticket: ProgressTicket): string {
  const fromLabel = DIVISI_LABEL[ticket.fromDivisi];
  const toLabel = DIVISI_LABEL[ticket.toDivisi];
  switch (ticket.stage) {
    case "MENUNGGU_MANAGER_ASAL":
      return `Menunggu persetujuan manajer Divisi ${fromLabel}.`;
    case "MENUNGGU_MANAGER_TUJUAN":
      return `Menunggu persetujuan manajer Divisi ${toLabel}.`;
    case "MENUNGGU_STAF_TUJUAN":
      return `Sudah diterima. Menunggu staf Divisi ${toLabel} mulai memproses.`;
    case "DIPROSES":
      return `Sedang dikerjakan staf Divisi ${toLabel}.`;
    case "SELESAI":
      return "Pengaduan sudah selesai ditangani.";
    case "DITOLAK":
      return rejectedPosition(ticket) === 2
        ? `Ditolak oleh manajer Divisi ${toLabel}.`
        : `Ditolak oleh manajer Divisi ${fromLabel}.`;
  }
}

import { api, type DownloadedFile } from "@/lib/api";
import type {
  ActionCounts,
  AdvancedTicket,
  CreatedTicket,
  CreateTicketInput,
  StageAction,
  TicketDetail,
  TicketList,
  TicketListFilters,
  TicketListItem,
  TicketListQuery,
  TicketStats,
  UploadedAttachment,
} from "@/types/ticket.types";

const UPLOAD_FIELD_NAME = "file";

const TICKET_ID_PATTERN = /^[A-Za-z0-9-]{1,100}$/;

const QUERY_KEYS = ["search", "status", "divisi", "dateFrom", "dateTo", "page", "limit"] as const;

export function isValidTicketId(id: string): boolean {
  return TICKET_ID_PATTERN.test(id);
}

function ticketPath(id: string): string {
  return `/tickets/${encodeURIComponent(id)}`;
}

function withQuery(path: string, query: TicketListQuery): string {
  const params = new URLSearchParams();
  for (const key of QUERY_KEYS) {
    const value = query[key];
    if (value === undefined) continue;
    const text = String(value).trim();
    if (text !== "") params.set(key, text);
  }
  const search = params.toString();
  return search === "" ? path : `${path}?${search}`;
}

export function createTicket(input: CreateTicketInput): Promise<CreatedTicket> {
  return api.post<CreatedTicket>("/tickets", {
    toDivisi: input.toDivisi,
    description: input.description,
  });
}

export function uploadAttachment(ticketId: string, file: File): Promise<UploadedAttachment> {
  const formData = new FormData();
  formData.append(UPLOAD_FIELD_NAME, file);
  return api.upload<UploadedAttachment>(`${ticketPath(ticketId)}/attachments`, formData);
}

export function listOutgoingTickets(query: TicketListQuery): Promise<TicketList> {
  return api.get<TicketList>(withQuery("/tickets/outgoing", query));
}

export function listIncomingTickets(query: TicketListQuery): Promise<TicketList> {
  return api.get<TicketList>(withQuery("/tickets/incoming", query));
}

export function listAllTickets(query: TicketListQuery): Promise<TicketList> {
  return api.get<TicketList>(withQuery("/tickets/all", query));
}

export function getActionCounts(): Promise<ActionCounts> {
  return api.get<ActionCounts>("/tickets/action-counts");
}

export function getTicketStats(): Promise<TicketStats> {
  return api.get<TicketStats>("/tickets/stats");
}

export function getRecentTickets(): Promise<TicketListItem[]> {
  return api.get<TicketListItem[]>("/tickets/recent");
}

export function getTicket(id: string): Promise<TicketDetail> {
  return api.get<TicketDetail>(ticketPath(id));
}

export function advanceTicketStage(id: string, action: StageAction): Promise<AdvancedTicket> {
  return api.patch<AdvancedTicket>(`${ticketPath(id)}/stage`, { action });
}

export function downloadAttachment(ticketId: string, attachmentId: string): Promise<DownloadedFile> {
  return api.download(`${ticketPath(ticketId)}/attachments/${encodeURIComponent(attachmentId)}`);
}

export function downloadOutgoingExport(filters: TicketListFilters): Promise<DownloadedFile> {
  return api.download(withQuery("/tickets/outgoing/export", filters));
}

export function ticketDetailHref(id: string): string {
  return `/ticket/${encodeURIComponent(id)}`;
}

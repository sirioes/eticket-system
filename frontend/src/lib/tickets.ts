import { api } from "@/lib/api";
import type {
  CreatedTicket,
  CreateTicketInput,
  UploadedAttachment,
} from "@/types/ticket.types";

const UPLOAD_FIELD_NAME = "file";

export function createTicket(input: CreateTicketInput): Promise<CreatedTicket> {
  return api.post<CreatedTicket>("/tickets", {
    toDivisi: input.toDivisi,
    description: input.description,
  });
}

export function uploadAttachment(ticketId: string, file: File): Promise<UploadedAttachment> {
  const formData = new FormData();
  formData.append(UPLOAD_FIELD_NAME, file);
  return api.upload<UploadedAttachment>(
    `/tickets/${encodeURIComponent(ticketId)}/attachments`,
    formData,
  );
}

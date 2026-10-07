import { TicketStage } from '../../../../generated/prisma/client';
import { VisibleTicket } from '../../../domain/ticket-visibility';
import { AllowedMimeType } from '../../domain/attachment-rules';

export interface NewAttachment {
  readonly fileName: string;
  readonly storedName: string;
  readonly mimeType: AllowedMimeType;
  readonly size: number;
  readonly uploadedById: number;
}

export interface StoredAttachment {
  readonly id: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly size: number;
}

export interface UploadTarget {
  readonly stage: TicketStage;
  readonly attachmentCount: number;
}

export interface LockedTicket {
  readonly stage: TicketStage;
  countAttachments(): Promise<number>;
  insert(attachment: NewAttachment): Promise<StoredAttachment>;
}

export interface DownloadableAttachment {
  readonly fileName: string;
  readonly storedName: string;
  readonly mimeType: string;
  readonly ticket: VisibleTicket;
}

export class UploadContentionError extends Error {
  constructor() {
    super('Menunggu kunci pengaduan terlalu lama');
    this.name = 'UploadContentionError';
  }
}

export abstract class AttachmentRepository {
  abstract findUploadTarget(
    ticketId: string,
    uploaderId: number,
  ): Promise<UploadTarget | null>;

  abstract findForDownload(
    ticketId: string,
    attachmentId: string,
  ): Promise<DownloadableAttachment | null>;

  abstract withLockedTicket<T extends object>(
    ticketId: string,
    uploaderId: number,
    work: (ticket: LockedTicket) => Promise<T>,
  ): Promise<T | null>;
}

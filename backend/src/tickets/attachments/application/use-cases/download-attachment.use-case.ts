import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { AuthUser } from '../../../../auth/domain/auth-user';
import { canViewTicket } from '../../../domain/ticket-visibility';
import { isAllowedMimeType } from '../../domain/attachment-rules';
import { AttachmentFileStore } from '../ports/attachment-file-store';
import { AttachmentRepository } from '../ports/attachment.repository';

export const ATTACHMENT_NOT_FOUND_MESSAGE = 'Lampiran tidak ditemukan';

export const FALLBACK_MIME_TYPE = 'application/octet-stream';

export interface DownloadAttachmentQuery {
  user: AuthUser;
  ticketId: string;
  attachmentId: string;
}

export interface DownloadedAttachment {
  fileName: string;
  mimeType: string;
  size: number;
  stream: Readable;
}

@Injectable()
export class DownloadAttachmentUseCase {
  private readonly logger = new Logger(DownloadAttachmentUseCase.name);

  constructor(
    private readonly attachments: AttachmentRepository,
    private readonly files: AttachmentFileStore,
  ) {}

  async execute(query: DownloadAttachmentQuery): Promise<DownloadedAttachment> {
    const attachment = await this.attachments.findForDownload(
      query.ticketId,
      query.attachmentId,
    );
    if (attachment === null || !canViewTicket(query.user, attachment.ticket)) {
      throw new NotFoundException(ATTACHMENT_NOT_FOUND_MESSAGE);
    }

    const file = await this.files.open(attachment.storedName);
    if (file === null) {
      this.logger.error(
        `Berkas lampiran ${query.attachmentId} tidak ada di penyimpanan`,
      );
      throw new NotFoundException(ATTACHMENT_NOT_FOUND_MESSAGE);
    }

    return {
      fileName: attachment.fileName,
      mimeType: isAllowedMimeType(attachment.mimeType)
        ? attachment.mimeType
        : FALLBACK_MIME_TYPE,
      size: file.size,
      stream: file.stream,
    };
  }
}

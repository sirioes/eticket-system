import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { AuthUser } from '../../../auth/domain/auth-user';
import { AttachmentFileStore } from '../../attachments/application/ports/attachment-file-store';
import { FALLBACK_MIME_TYPE } from '../../attachments/application/use-cases/download-attachment.use-case';
import { isAllowedCompletionMimeType } from '../../domain/completion-file-rules';
import { canViewTicket } from '../../domain/ticket-visibility';
import { CompletionFileRepository } from '../ports/completion-file.repository';

export const COMPLETION_FILE_NOT_FOUND_MESSAGE =
  'Dokumen penyelesaian tidak ditemukan';

export interface DownloadCompletionFileQuery {
  readonly user: AuthUser;
  readonly ticketId: string;
  readonly fileId: string;
}

export interface DownloadedCompletionFile {
  readonly fileName: string;
  readonly mimeType: string;
  readonly size: number;
  readonly stream: Readable;
}

@Injectable()
export class DownloadCompletionFileUseCase {
  private readonly logger = new Logger(DownloadCompletionFileUseCase.name);

  constructor(
    private readonly completionFiles: CompletionFileRepository,
    private readonly files: AttachmentFileStore,
  ) {}

  async execute(
    query: DownloadCompletionFileQuery,
  ): Promise<DownloadedCompletionFile> {
    const record = await this.completionFiles.findForDownload(
      query.ticketId,
      query.fileId,
    );
    if (record === null || !canViewTicket(query.user, record.ticket)) {
      throw new NotFoundException(COMPLETION_FILE_NOT_FOUND_MESSAGE);
    }

    const file = await this.files.open(record.storedName);
    if (file === null) {
      this.logger.error(
        `Berkas dokumen penyelesaian ${query.fileId} tidak ada di penyimpanan`,
      );
      throw new NotFoundException(COMPLETION_FILE_NOT_FOUND_MESSAGE);
    }

    return {
      fileName: record.fileName,
      mimeType: isAllowedCompletionMimeType(record.mimeType)
        ? record.mimeType
        : FALLBACK_MIME_TYPE,
      size: file.size,
      stream: file.stream,
    };
  }
}

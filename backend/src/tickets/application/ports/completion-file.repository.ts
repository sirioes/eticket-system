import type { VisibleTicket } from '../../domain/ticket-visibility';

export interface DownloadableCompletionFile {
  readonly fileName: string;
  readonly storedName: string;
  readonly mimeType: string;
  readonly ticket: VisibleTicket;
}

export abstract class CompletionFileRepository {
  abstract findForDownload(
    ticketId: string,
    fileId: string,
  ): Promise<DownloadableCompletionFile | null>;
}

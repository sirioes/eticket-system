import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CompletionFileRepository,
  DownloadableCompletionFile,
} from '../application/ports/completion-file.repository';

@Injectable()
export class PrismaCompletionFileRepository implements CompletionFileRepository {
  constructor(private readonly prisma: PrismaService) {}

  findForDownload(
    ticketId: string,
    fileId: string,
  ): Promise<DownloadableCompletionFile | null> {
    return this.prisma.ticketCompletionFile.findFirst({
      where: { id: fileId, ticketId },
      select: {
        fileName: true,
        storedName: true,
        mimeType: true,
        ticket: {
          select: {
            fromDivisi: true,
            toDivisi: true,
            stage: true,
            rejectedAtStage: true,
          },
        },
      },
    });
  }
}

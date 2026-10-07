import { Injectable } from '@nestjs/common';
import { Prisma, TicketStage } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AttachmentRepository,
  DownloadableAttachment,
  LockedTicket,
  UploadContentionError,
  UploadTarget,
} from '../application/ports/attachment.repository';

const CONTENTION_ERROR_CODES: readonly string[] = ['P2028', 'P2034'];

const TRANSACTION_OPTIONS = {
  maxWait: 5_000,
  timeout: 10_000,

  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
} as const;

@Injectable()
export class PrismaAttachmentRepository implements AttachmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUploadTarget(
    ticketId: string,
    uploaderId: number,
  ): Promise<UploadTarget | null> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, createdById: uploaderId },
      select: { stage: true, _count: { select: { attachments: true } } },
    });
    if (ticket === null) return null;
    return { stage: ticket.stage, attachmentCount: ticket._count.attachments };
  }

  async findForDownload(
    ticketId: string,
    attachmentId: string,
  ): Promise<DownloadableAttachment | null> {
    return this.prisma.ticketAttachment.findFirst({
      where: { id: attachmentId, ticketId },
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

  async withLockedTicket<T extends object>(
    ticketId: string,
    uploaderId: number,
    work: (ticket: LockedTicket) => Promise<T>,
  ): Promise<T | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ stage: TicketStage }[]>`
          SELECT stage FROM Ticket
          WHERE id = ${ticketId} AND createdById = ${uploaderId}
          FOR UPDATE`;
        if (rows.length === 0) return null;

        return work({
          stage: rows[0].stage,
          countAttachments: () =>
            tx.ticketAttachment.count({ where: { ticketId } }),
          insert: (attachment) =>
            tx.ticketAttachment.create({
              data: {
                ticketId,
                fileName: attachment.fileName,
                storedName: attachment.storedName,
                mimeType: attachment.mimeType,
                size: attachment.size,
                uploadedById: attachment.uploadedById,
              },
              select: { id: true, fileName: true, mimeType: true, size: true },
            }),
        });
      }, TRANSACTION_OPTIONS);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        CONTENTION_ERROR_CODES.includes(error.code)
      ) {
        throw new UploadContentionError();
      }
      throw error;
    }
  }
}

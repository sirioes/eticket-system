import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TicketStage } from '../../../../generated/prisma/client';
import { AuthUser } from '../../../../auth/domain/auth-user';
import {
  canonicalMimeType,
  canReceiveAttachments,
  extensionMatchesMimeType,
  isAllowedMimeType,
  MAX_ATTACHMENTS_PER_TICKET,
  sanitizeDisplayFileName,
  UNSUPPORTED_FILE_TYPE_MESSAGE,
} from '../../domain/attachment-rules';
import { AttachmentFileStore } from '../ports/attachment-file-store';
import {
  AttachmentRepository,
  StoredAttachment,
  UploadContentionError,
} from '../ports/attachment.repository';

export const TICKET_NOT_FOUND_MESSAGE = 'Pengaduan tidak ditemukan';

export const STAGE_LOCKED_MESSAGE =
  'Lampiran hanya dapat ditambahkan selama pengaduan masih menunggu manajer divisi asal';

export const ATTACHMENT_LIMIT_MESSAGE = `Maksimum ${MAX_ATTACHMENTS_PER_TICKET} lampiran per pengaduan`;

export const UPLOAD_BUSY_MESSAGE =
  'Pengaduan ini sedang memproses lampiran lain, silakan coba lagi sebentar lagi';

export interface UploadAttachmentCommand {
  uploader: AuthUser;
  ticketId: string;
  file: {
    storedName: string;

    originalName: string;
    size: number;
  };
}

export type UploadedAttachment = StoredAttachment;

function assertStageAcceptsAttachments(stage: TicketStage): void {
  if (!canReceiveAttachments(stage)) {
    throw new ConflictException(STAGE_LOCKED_MESSAGE);
  }
}

function assertBelowAttachmentLimit(count: number): void {
  if (count >= MAX_ATTACHMENTS_PER_TICKET) {
    throw new ConflictException(ATTACHMENT_LIMIT_MESSAGE);
  }
}

@Injectable()
export class UploadAttachmentUseCase {
  private readonly logger = new Logger(UploadAttachmentUseCase.name);

  constructor(
    private readonly attachments: AttachmentRepository,
    private readonly files: AttachmentFileStore,
  ) {}

  async assertCanUpload(uploader: AuthUser, ticketId: string): Promise<void> {
    const target = await this.attachments.findUploadTarget(
      ticketId,
      uploader.id,
    );

    if (target === null) throw new NotFoundException(TICKET_NOT_FOUND_MESSAGE);
    assertStageAcceptsAttachments(target.stage);
    assertBelowAttachmentLimit(target.attachmentCount);
  }

  async execute(command: UploadAttachmentCommand): Promise<UploadedAttachment> {
    try {
      return await this.store(command);
    } catch (error) {
      await this.discard(command.file.storedName);
      throw error;
    }
  }

  private async store(
    command: UploadAttachmentCommand,
  ): Promise<UploadedAttachment> {
    const { uploader, ticketId, file } = command;

    const rawDetected = await this.files.detectMimeType(file.storedName);
    const detected =
      rawDetected === null ? null : canonicalMimeType(rawDetected);
    if (
      detected === null ||
      !isAllowedMimeType(detected) ||
      !extensionMatchesMimeType(file.originalName, detected)
    ) {
      throw new BadRequestException(UNSUPPORTED_FILE_TYPE_MESSAGE);
    }

    let saved: UploadedAttachment | null;
    try {
      saved = await this.attachments.withLockedTicket(
        ticketId,
        uploader.id,
        async (ticket) => {
          assertStageAcceptsAttachments(ticket.stage);
          assertBelowAttachmentLimit(await ticket.countAttachments());

          return ticket.insert({
            fileName: sanitizeDisplayFileName(file.originalName),
            storedName: file.storedName,
            mimeType: detected,
            size: file.size,
            uploadedById: uploader.id,
          });
        },
      );
    } catch (error) {
      if (error instanceof UploadContentionError) {
        throw new ConflictException(UPLOAD_BUSY_MESSAGE);
      }
      throw error;
    }

    if (saved === null) throw new NotFoundException(TICKET_NOT_FOUND_MESSAGE);
    return saved;
  }

  private async discard(storedName: string): Promise<void> {
    try {
      await this.files.remove(storedName);
    } catch (error) {
      this.logger.warn(
        `Gagal menghapus file lampiran yatim ${storedName}: ${String(error)}`,
      );
    }
  }
}

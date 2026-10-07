import { Module } from '@nestjs/common';
import { AttachmentFileStore } from './application/ports/attachment-file-store';
import { AttachmentRepository } from './application/ports/attachment.repository';
import { DownloadAttachmentUseCase } from './application/use-cases/download-attachment.use-case';
import { UploadAttachmentUseCase } from './application/use-cases/upload-attachment.use-case';
import { DiskAttachmentFileStore } from './infrastructure/disk-attachment-file-store';
import { PrismaAttachmentRepository } from './infrastructure/prisma-attachment.repository';
import { AttachmentsController } from './presentation/attachments.controller';
import { UploadTargetGuard } from './presentation/upload-target.guard';

@Module({
  controllers: [AttachmentsController],
  providers: [
    { provide: AttachmentRepository, useClass: PrismaAttachmentRepository },
    { provide: AttachmentFileStore, useClass: DiskAttachmentFileStore },
    UploadAttachmentUseCase,
    DownloadAttachmentUseCase,
    UploadTargetGuard,
  ],
})
export class AttachmentsModule {}

import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../../auth/domain/auth-user';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import {
  AnyRole,
  Roles,
} from '../../../auth/presentation/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { DownloadAttachmentUseCase } from '../application/use-cases/download-attachment.use-case';
import {
  UploadAttachmentUseCase,
  UploadedAttachment,
} from '../application/use-cases/upload-attachment.use-case';
import {
  attachmentMulterOptions,
  UPLOAD_FIELD_NAME,
  UPLOAD_THROTTLE,
} from '../attachments.config';
import { attachmentDisposition } from './content-disposition';
import { UploadTargetGuard } from './upload-target.guard';

export const FILE_REQUIRED_MESSAGE = 'File wajib dilampirkan';

@Controller('tickets/:ticketId/attachments')
export class AttachmentsController {
  constructor(
    private readonly uploadAttachment: UploadAttachmentUseCase,
    private readonly downloadAttachment: DownloadAttachmentUseCase,
  ) {}

  @Roles(
    Role.TEAM_MAIN_OFFICE,
    Role.MANAGER_MAIN_OFFICE,
    Role.FINANCE_MAIN_OFFICE,
    Role.FINANCE_MANAGER_MAIN_OFFICE,
  )
  @Throttle(UPLOAD_THROTTLE)
  @Post()
  @UseGuards(UploadTargetGuard)
  @UseInterceptors(FileInterceptor(UPLOAD_FIELD_NAME, attachmentMulterOptions))
  upload(
    @CurrentUser() user: AuthUser,
    @Param('ticketId') ticketId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<UploadedAttachment> {
    if (!file) throw new BadRequestException(FILE_REQUIRED_MESSAGE);

    return this.uploadAttachment.execute({
      uploader: user,
      ticketId,
      file: {
        storedName: file.filename,
        originalName: file.originalname,
        size: file.size,
      },
    });
  }

  @AnyRole()
  @Get(':attachmentId')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  @Header('Cache-Control', 'private, no-store')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('ticketId') ticketId: string,
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const file = await this.downloadAttachment.execute({
      user,
      ticketId,
      attachmentId,
    });

    response.once('close', () => file.stream.destroy());

    return new StreamableFile(file.stream, {
      type: file.mimeType,
      length: file.size,
      disposition: attachmentDisposition(file.fileName),
    });
  }
}

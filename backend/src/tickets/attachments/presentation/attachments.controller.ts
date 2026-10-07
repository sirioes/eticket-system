import {
  BadRequestException,
  Controller,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../../auth/domain/auth-user';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import {
  UploadAttachmentUseCase,
  UploadedAttachment,
} from '../application/use-cases/upload-attachment.use-case';
import {
  attachmentMulterOptions,
  UPLOAD_FIELD_NAME,
  UPLOAD_THROTTLE,
} from '../attachments.config';
import { UploadTargetGuard } from './upload-target.guard';

export const FILE_REQUIRED_MESSAGE = 'File wajib dilampirkan';

@Controller('tickets/:ticketId/attachments')
export class AttachmentsController {
  constructor(private readonly uploadAttachment: UploadAttachmentUseCase) {}

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
}

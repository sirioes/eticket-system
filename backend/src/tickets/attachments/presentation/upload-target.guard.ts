import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../auth/domain/auth-user';
import { UploadAttachmentUseCase } from '../application/use-cases/upload-attachment.use-case';

@Injectable()
export class UploadTargetGuard implements CanActivate {
  constructor(private readonly uploadAttachment: UploadAttachmentUseCase) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ user: AuthUser; params: { ticketId: string } }>();
    await this.uploadAttachment.assertCanUpload(
      request.user,
      request.params.ticketId,
    );
    return true;
  }
}

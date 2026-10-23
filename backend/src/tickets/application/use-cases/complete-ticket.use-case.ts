import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../../../auth/domain/auth-user';
import {
  canonicalMimeType,
  sanitizeDisplayFileName,
} from '../../attachments/domain/attachment-rules';
import { AttachmentFileStore } from '../../attachments/application/ports/attachment-file-store';
import { TICKET_NOT_FOUND_MESSAGE } from '../../attachments/application/use-cases/upload-attachment.use-case';
import {
  COMPLETION_FILE_SIZE_MESSAGE,
  completionExtensionMatchesMimeType,
  isAllowedCompletionMimeType,
  isCompletionFileSizeValid,
  MAX_COMPLETION_FILES,
  UNSUPPORTED_COMPLETION_FILE_MESSAGE,
} from '../../domain/completion-file-rules';
import {
  isAuthorizedActor,
  resolveNextStage,
} from '../../domain/ticket-stage-flow';
import { canViewTicket, VisibleTicket } from '../../domain/ticket-visibility';
import { TicketQueryRepository } from '../ports/ticket-query.repository';
import {
  NewCompletionFile,
  TicketStageRepository,
} from '../ports/ticket-stage.repository';
import {
  ACTION_NOT_AVAILABLE_MESSAGE,
  AdvancedTicket,
  NOT_AUTHORIZED_ACTOR_MESSAGE,
  STAGE_CHANGED_MESSAGE,
} from './advance-ticket-stage.use-case';

export const COMPLETION_FILE_LIMIT_MESSAGE = `Maksimum ${MAX_COMPLETION_FILES} dokumen penyelesaian`;

export interface UploadedCompletionFile {
  readonly storedName: string;
  readonly originalName: string;
  readonly size: number;
}

export interface CompleteTicketCommand {
  readonly actor: AuthUser;
  readonly ticketId: string;
  readonly files: readonly UploadedCompletionFile[];
}

@Injectable()
export class CompleteTicketUseCase {
  private readonly logger = new Logger(CompleteTicketUseCase.name);

  constructor(
    private readonly queries: TicketQueryRepository,
    private readonly stages: TicketStageRepository,
    private readonly files: AttachmentFileStore,
  ) {}

  async assertCanComplete(actor: AuthUser, ticketId: string): Promise<void> {
    await this.loadCompletable(actor, ticketId);
  }

  async execute(command: CompleteTicketCommand): Promise<AdvancedTicket> {
    try {
      return await this.complete(command);
    } catch (error) {
      await this.discardAll(command.files);
      throw error;
    }
  }

  private async complete(
    command: CompleteTicketCommand,
  ): Promise<AdvancedTicket> {
    const { actor, ticketId } = command;
    const ticket = await this.loadCompletable(actor, ticketId);

    if (command.files.length > MAX_COMPLETION_FILES) {
      throw new BadRequestException(COMPLETION_FILE_LIMIT_MESSAGE);
    }
    const completionFiles = await this.validate(command.files);

    const advanced = await this.stages.advanceStage({
      ticketId,
      expectedStage: ticket.stage,
      action: 'SELESAI',
      nextStage: 'SELESAI',
      actorId: actor.id,
      reason: null,
      completionFiles,
    });
    if (!advanced) {
      throw new ConflictException(STAGE_CHANGED_MESSAGE);
    }

    return { id: ticketId, stage: 'SELESAI' };
  }

  private async loadCompletable(
    actor: AuthUser,
    ticketId: string,
  ): Promise<VisibleTicket> {
    const ticket = await this.queries.findVisibilityById(ticketId);
    if (ticket === null || !canViewTicket(actor, ticket)) {
      throw new NotFoundException(TICKET_NOT_FOUND_MESSAGE);
    }
    if (!isAuthorizedActor(actor, ticket)) {
      throw new ForbiddenException(NOT_AUTHORIZED_ACTOR_MESSAGE);
    }
    if (resolveNextStage(ticket.stage, 'SELESAI') === null) {
      throw new ConflictException(ACTION_NOT_AVAILABLE_MESSAGE);
    }
    return ticket;
  }

  private async validate(
    files: readonly UploadedCompletionFile[],
  ): Promise<NewCompletionFile[]> {
    const validated: NewCompletionFile[] = [];
    for (const file of files) {
      if (!isCompletionFileSizeValid(file.size)) {
        throw new BadRequestException(COMPLETION_FILE_SIZE_MESSAGE);
      }
      const raw = await this.files.detectMimeType(file.storedName);
      const detected = raw === null ? null : canonicalMimeType(raw);
      if (
        detected === null ||
        !isAllowedCompletionMimeType(detected) ||
        !completionExtensionMatchesMimeType(file.originalName, detected)
      ) {
        throw new BadRequestException(UNSUPPORTED_COMPLETION_FILE_MESSAGE);
      }
      validated.push({
        fileName: sanitizeDisplayFileName(file.originalName),
        storedName: file.storedName,
        mimeType: detected,
        size: file.size,
      });
    }
    return validated;
  }

  private async discardAll(
    files: readonly UploadedCompletionFile[],
  ): Promise<void> {
    for (const file of files) {
      try {
        await this.files.remove(file.storedName);
      } catch (error) {
        this.logger.warn(
          `Gagal menghapus dokumen penyelesaian yatim ${file.storedName}: ${String(error)}`,
        );
      }
    }
  }
}

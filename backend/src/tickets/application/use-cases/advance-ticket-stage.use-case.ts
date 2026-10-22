import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../../../auth/domain/auth-user';
import {
  hasLoneSurrogate,
  hasUnsafeInvisibleCharacter,
  normalizeMultilineText,
} from '../../../common/utils/text-safety';
import { TicketStage } from '../../../generated/prisma/client';
import { TICKET_NOT_FOUND_MESSAGE } from '../../attachments/application/use-cases/upload-attachment.use-case';
import {
  isAuthorizedActor,
  resolveNextStage,
  StageAction,
} from '../../domain/ticket-stage-flow';
import {
  isReasonLengthValid,
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
  requiresReason,
} from '../../domain/ticket-message-rules';
import { canViewTicket } from '../../domain/ticket-visibility';
import { TicketQueryRepository } from '../ports/ticket-query.repository';
import { TicketStageRepository } from '../ports/ticket-stage.repository';

export const NOT_AUTHORIZED_ACTOR_MESSAGE =
  'Anda tidak berwenang melakukan aksi ini pada pengaduan ini';

export const ACTION_NOT_AVAILABLE_MESSAGE =
  'Aksi ini tidak tersedia untuk tahap pengaduan saat ini';

export const STAGE_CHANGED_MESSAGE =
  'Status pengaduan baru saja berubah, muat ulang halaman';

export const REASON_LENGTH_MESSAGE = `Alasan harus ${REASON_MIN_LENGTH}–${REASON_MAX_LENGTH} karakter`;

export const REASON_INVALID_CHARACTER_MESSAGE =
  'Alasan mengandung karakter tidak valid';

export const REASON_NOT_ALLOWED_MESSAGE =
  'Alasan hanya diisi saat menerima atau menolak pengaduan';

export const COMPLETE_VIA_ENDPOINT_MESSAGE =
  'Penyelesaian pengaduan dilakukan melalui endpoint selesai';

export interface AdvanceTicketStageCommand {
  readonly actor: AuthUser;
  readonly ticketId: string;
  readonly action: StageAction;
  readonly reason?: string;
}

export interface AdvancedTicket {
  readonly id: string;
  readonly stage: TicketStage;
}

@Injectable()
export class AdvanceTicketStageUseCase {
  constructor(
    private readonly queries: TicketQueryRepository,
    private readonly stages: TicketStageRepository,
  ) {}

  async execute(command: AdvanceTicketStageCommand): Promise<AdvancedTicket> {
    const { actor, ticketId, action } = command;

    const ticket = await this.queries.findVisibilityById(ticketId);
    if (ticket === null || !canViewTicket(actor, ticket)) {
      throw new NotFoundException(TICKET_NOT_FOUND_MESSAGE);
    }
    if (!isAuthorizedActor(actor, ticket)) {
      throw new ForbiddenException(NOT_AUTHORIZED_ACTOR_MESSAGE);
    }

    const nextStage = resolveNextStage(ticket.stage, action);
    if (nextStage === null) {
      throw new ConflictException(ACTION_NOT_AVAILABLE_MESSAGE);
    }

    if (action === 'SELESAI') {
      throw new BadRequestException(COMPLETE_VIA_ENDPOINT_MESSAGE);
    }
    const reason = this.resolveReason(action, command.reason);

    const advanced = await this.stages.advanceStage({
      ticketId,
      expectedStage: ticket.stage,
      action,
      nextStage,
      actorId: actor.id,
      reason,
    });
    if (!advanced) {
      throw new ConflictException(STAGE_CHANGED_MESSAGE);
    }

    return { id: ticketId, stage: nextStage };
  }

  private resolveReason(
    action: StageAction,
    raw: string | undefined,
  ): string | null {
    if (!requiresReason(action)) {
      if (raw !== undefined) {
        throw new BadRequestException(REASON_NOT_ALLOWED_MESSAGE);
      }
      return null;
    }
    if (raw === undefined) {
      throw new BadRequestException(REASON_LENGTH_MESSAGE);
    }

    const reason = normalizeMultilineText(raw);
    if (hasLoneSurrogate(reason) || hasUnsafeInvisibleCharacter(reason)) {
      throw new BadRequestException(REASON_INVALID_CHARACTER_MESSAGE);
    }
    if (!isReasonLengthValid(reason)) {
      throw new BadRequestException(REASON_LENGTH_MESSAGE);
    }
    return reason;
  }
}

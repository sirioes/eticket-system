import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../../../auth/domain/auth-user';
import { Role } from '../../../common/enums/role.enum';
import {
  hasLoneSurrogate,
  hasUnsafeInvisibleCharacter,
  normalizeMultilineText,
} from '../../../common/utils/text-safety';
import { TICKET_NOT_FOUND_MESSAGE } from '../../attachments/application/use-cases/upload-attachment.use-case';
import {
  canReadComments,
  canWriteComments,
  COMMENT_MAX_LENGTH,
  COMMENT_MIN_LENGTH,
  isCommentLengthValid,
  MAX_MESSAGES_PER_TICKET,
} from '../../domain/ticket-message-rules';
import {
  MessageContentionError,
  TicketMessageRepository,
} from '../ports/ticket-message.repository';
import { TicketQueryRepository } from '../ports/ticket-query.repository';
import {
  TicketMessageView,
  toMessageView,
} from './list-ticket-messages.use-case';

export const COMMENT_LENGTH_MESSAGE = `Komentar harus ${COMMENT_MIN_LENGTH}–${COMMENT_MAX_LENGTH} karakter`;

export const COMMENT_INVALID_CHARACTER_MESSAGE =
  'Komentar mengandung karakter tidak valid';

export const COMMENT_CLOSED_MESSAGE =
  'Komentar tidak dapat ditulis pada status pengaduan saat ini';

export const MESSAGE_LIMIT_MESSAGE = `Batas ${MAX_MESSAGES_PER_TICKET} pesan pada pengaduan ini sudah tercapai`;

export const COMMENT_BUSY_MESSAGE =
  'Pengaduan sedang diproses, silakan kirim ulang';

export interface PostTicketCommentCommand {
  readonly user: AuthUser;
  readonly ticketId: string;
  readonly body: string;
}

@Injectable()
export class PostTicketCommentUseCase {
  constructor(
    private readonly tickets: TicketQueryRepository,
    private readonly messages: TicketMessageRepository,
  ) {}

  async execute(command: PostTicketCommentCommand): Promise<TicketMessageView> {
    const { user } = command;
    const ticket = await this.tickets.findVisibilityById(command.ticketId);
    if (
      ticket === null ||
      user.role === Role.SUPERADMIN ||
      !canReadComments(user, ticket)
    ) {
      throw new NotFoundException(TICKET_NOT_FOUND_MESSAGE);
    }

    const body = normalizeMultilineText(command.body);
    if (hasLoneSurrogate(body) || hasUnsafeInvisibleCharacter(body)) {
      throw new BadRequestException(COMMENT_INVALID_CHARACTER_MESSAGE);
    }
    if (!isCommentLengthValid(body)) {
      throw new BadRequestException(COMMENT_LENGTH_MESSAGE);
    }
    if (!canWriteComments(user, ticket)) {
      throw new ConflictException(COMMENT_CLOSED_MESSAGE);
    }

    try {
      const created = await this.messages.createComment({
        ticketId: command.ticketId,
        authorId: user.id,
        body,
        limit: MAX_MESSAGES_PER_TICKET,
      });
      if (created === null) throw new ConflictException(MESSAGE_LIMIT_MESSAGE);
      return toMessageView(created);
    } catch (error) {
      if (error instanceof MessageContentionError) {
        throw new ConflictException(COMMENT_BUSY_MESSAGE);
      }
      throw error;
    }
  }
}

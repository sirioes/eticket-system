import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Divisi } from '../../../common/enums/divisi.enum';
import {
  hasLoneSurrogate,
  hasUnsafeInvisibleCharacter,
  normalizeMultilineText,
} from '../../../common/utils/text-safety';
import { AuthUser } from '../../../auth/domain/auth-user';
import {
  generateTicketId,
  getTodayDateWita,
  nextSequence,
  TicketNumberLimitExceededException,
  ticketIdPrefix,
} from '../../domain/ticket-id-generator';
import {
  canSendTicket,
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  isDescriptionLengthValid,
} from '../../domain/ticket-rules';
import {
  DuplicateTicketIdError,
  TicketRepository,
} from '../ports/ticket.repository';

const MAX_ID_ATTEMPTS = 3;

export const CREATOR_WITHOUT_DIVISI_MESSAGE =
  'Akun tanpa divisi tidak dapat membuat pengaduan';

export const SAME_DIVISI_MESSAGE =
  'Divisi tujuan tidak boleh sama dengan divisi pengirim';

export const DESCRIPTION_LENGTH_MESSAGE = `Keterangan harus ${DESCRIPTION_MIN_LENGTH}–${DESCRIPTION_MAX_LENGTH} karakter`;

export const DESCRIPTION_INVALID_CHARACTER_MESSAGE =
  'Keterangan mengandung karakter tidak valid';

export const DAILY_LIMIT_MESSAGE =
  'Batas pengaduan harian divisi ini sudah tercapai';

export const TICKET_ID_BUSY_MESSAGE =
  'Nomor pengaduan sedang dipakai, silakan kirim ulang';

export interface CreateTicketCommand {
  creator: AuthUser;
  toDivisi: Divisi;
  description: string;
}

export interface CreatedTicket {
  id: string;
}

@Injectable()
export class CreateTicketUseCase {
  constructor(private readonly tickets: TicketRepository) {}

  async execute(command: CreateTicketCommand): Promise<CreatedTicket> {
    const { creator, toDivisi } = command;
    const fromDivisi = creator.divisi;

    if (!fromDivisi) {
      throw new ForbiddenException(CREATOR_WITHOUT_DIVISI_MESSAGE);
    }

    if (!canSendTicket(fromDivisi, toDivisi)) {
      throw new BadRequestException(SAME_DIVISI_MESSAGE);
    }

    const description = normalizeMultilineText(command.description);

    if (
      hasLoneSurrogate(description) ||
      hasUnsafeInvisibleCharacter(description)
    ) {
      throw new BadRequestException(DESCRIPTION_INVALID_CHARACTER_MESSAGE);
    }

    if (!isDescriptionLengthValid(description)) {
      throw new BadRequestException(DESCRIPTION_LENGTH_MESSAGE);
    }

    const dateWita = getTodayDateWita();
    const prefix = ticketIdPrefix(fromDivisi, dateWita);

    for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
      const latestId = await this.tickets.findLatestIdWithPrefix(prefix);
      const id = this.buildId(
        fromDivisi,
        dateWita,
        nextSequence(prefix, latestId),
      );

      try {
        await this.tickets.insert({
          id,
          description,
          fromDivisi,
          toDivisi,
          createdById: creator.id,
        });
        return { id };
      } catch (error) {
        if (!(error instanceof DuplicateTicketIdError)) throw error;
      }
    }

    throw new ConflictException(TICKET_ID_BUSY_MESSAGE);
  }

  private buildId(divisi: Divisi, dateWita: string, sequence: number): string {
    try {
      return generateTicketId(divisi, dateWita, sequence);
    } catch (error) {
      if (error instanceof TicketNumberLimitExceededException) {
        throw new ConflictException(DAILY_LIMIT_MESSAGE);
      }
      throw error;
    }
  }
}

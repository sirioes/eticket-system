import { Divisi } from '../../../common/enums/divisi.enum';

export interface NewTicket {
  readonly id: string;
  readonly description: string;
  readonly fromDivisi: Divisi;
  readonly toDivisi: Divisi;
  readonly createdById: number;
}

export class DuplicateTicketIdError extends Error {
  constructor(id: string) {
    super(`ID tiket ${id} sudah dipakai`);
  }
}

export abstract class TicketRepository {
  abstract findLatestIdWithPrefix(prefix: string): Promise<string | null>;

  abstract insert(ticket: NewTicket): Promise<void>;
}
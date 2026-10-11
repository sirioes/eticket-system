import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../../auth/domain/auth-user';
import { TicketQueryRepository } from '../ports/ticket-query.repository';
import {
  requireDivisi,
  TicketListItemView,
  toTicketListItemView,
} from './ticket-list-query';

export const RECENT_TICKETS_LIMIT = 7;

@Injectable()
export class GetRecentTicketsUseCase {
  constructor(private readonly tickets: TicketQueryRepository) {}

  async execute(user: AuthUser): Promise<TicketListItemView[]> {
    const divisi = requireDivisi(user);

    const recent = await this.tickets.listRecent(
      { fromDivisi: divisi },
      { viewer: { role: user.role, divisi } },
      RECENT_TICKETS_LIMIT,
    );

    return recent.map(toTicketListItemView);
  }
}

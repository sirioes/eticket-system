import { Injectable } from '@nestjs/common';
import { TicketQueryRepository } from '../ports/ticket-query.repository';
import {
  requireDivisi,
  TicketListQuery,
  TicketListView,
  toTicketListFilter,
  toTicketListView,
} from './ticket-list-query';

@Injectable()
export class ListIncomingTicketsUseCase {
  constructor(private readonly tickets: TicketQueryRepository) {}

  async execute(query: TicketListQuery): Promise<TicketListView> {
    const divisi = requireDivisi(query.user);
    const filter = toTicketListFilter(query);

    const page = await this.tickets.listIncoming(
      { viewer: { role: query.user.role, divisi } },
      filter,
      { page: query.page, limit: query.limit },
    );

    return toTicketListView(page, query);
  }
}

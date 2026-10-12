import { Injectable } from '@nestjs/common';
import { TicketQueryRepository } from '../ports/ticket-query.repository';
import {
  TicketListView,
  toTicketListFilter,
  toTicketListView,
} from './ticket-list-query';

export type ListAllTicketsQuery = Parameters<typeof toTicketListFilter>[0] & {
  readonly page: number;
  readonly limit: number;
};

@Injectable()
export class ListAllTicketsUseCase {
  constructor(private readonly tickets: TicketQueryRepository) {}

  async execute(query: ListAllTicketsQuery): Promise<TicketListView> {
    const filter = toTicketListFilter(query);

    const page = await this.tickets.listAll(filter, {
      page: query.page,
      limit: query.limit,
    });

    return toTicketListView(page, query);
  }
}

import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../../auth/domain/auth-user';
import { TicketQueryRepository } from '../ports/ticket-query.repository';
import { requireDivisi } from './ticket-list-query';

export interface TicketStatsView {
  readonly total: number;
  readonly incoming: number;
  readonly outgoing: number;
  readonly selesai: number;
}

@Injectable()
export class GetTicketStatsUseCase {
  constructor(private readonly tickets: TicketQueryRepository) {}

  async execute(user: AuthUser): Promise<TicketStatsView> {
    const divisi = requireDivisi(user);
    const outgoingScope = { fromDivisi: divisi };
    const incomingScope = { viewer: { role: user.role, divisi } };

    const [outgoing, incoming, selesai] = await Promise.all([
      this.tickets.countOutgoing(outgoingScope, {}),
      this.tickets.countIncoming(incomingScope, {}),
      this.tickets.countIncoming(incomingScope, { stage: 'SELESAI' }),
    ]);

    return { total: outgoing + incoming, incoming, outgoing, selesai };
  }
}

import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../../auth/domain/auth-user';
import { actionableStages } from '../../domain/ticket-stage-flow';
import { TicketQueryRepository } from '../ports/ticket-query.repository';
import { requireDivisi } from './ticket-list-query';

export interface ActionCountsView {
  readonly outgoing: number;
  readonly incoming: number;
}

@Injectable()
export class GetActionCountsUseCase {
  constructor(private readonly tickets: TicketQueryRepository) {}

  async execute(user: AuthUser): Promise<ActionCountsView> {
    const divisi = requireDivisi(user);
    const stages = actionableStages({ role: user.role, divisi });

    const [outgoing, incoming] = await Promise.all([
      stages.outgoing.length === 0
        ? 0
        : this.tickets.countOutgoingInStages(divisi, stages.outgoing),
      stages.incoming.length === 0
        ? 0
        : this.tickets.countIncomingInStages(divisi, stages.incoming),
    ]);

    return { outgoing, incoming };
  }
}

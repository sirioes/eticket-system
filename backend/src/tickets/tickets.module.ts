import { Module } from '@nestjs/common';
import { AttachmentsModule } from './attachments/attachments.module';
import { TicketQueryRepository } from './application/ports/ticket-query.repository';
import { TicketStageRepository } from './application/ports/ticket-stage.repository';
import { TicketRepository } from './application/ports/ticket.repository';
import { AdvanceTicketStageUseCase } from './application/use-cases/advance-ticket-stage.use-case';
import { CreateTicketUseCase } from './application/use-cases/create-ticket.use-case';
import { GetActionCountsUseCase } from './application/use-cases/get-action-counts.use-case';
import { GetTicketByIdUseCase } from './application/use-cases/get-ticket-by-id.use-case';
import { ListIncomingTicketsUseCase } from './application/use-cases/list-incoming-tickets.use-case';
import { ListOutgoingTicketsUseCase } from './application/use-cases/list-outgoing-tickets.use-case';
import { PrismaTicketQueryRepository } from './infrastructure/prisma-ticket-query.repository';
import { PrismaTicketStageRepository } from './infrastructure/prisma-ticket-stage.repository';
import { PrismaTicketRepository } from './infrastructure/prisma-ticket.repository';
import { TicketsController } from './presentation/tickets.controller';

@Module({
  imports: [AttachmentsModule],
  controllers: [TicketsController],
  providers: [
    { provide: TicketRepository, useClass: PrismaTicketRepository },
    { provide: TicketQueryRepository, useClass: PrismaTicketQueryRepository },
    { provide: TicketStageRepository, useClass: PrismaTicketStageRepository },
    CreateTicketUseCase,
    ListOutgoingTicketsUseCase,
    ListIncomingTicketsUseCase,
    GetActionCountsUseCase,
    GetTicketByIdUseCase,
    AdvanceTicketStageUseCase,
  ],
})
export class TicketsModule {}

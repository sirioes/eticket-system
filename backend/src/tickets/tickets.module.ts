import { Module } from '@nestjs/common';
import { TicketRepository } from './application/ports/ticket.repository';
import { CreateTicketUseCase } from './application/use-cases/create-ticket.use-case';
import { PrismaTicketRepository } from './infrastructure/prisma-ticket.repository';
import { TicketsController } from './presentation/tickets.controller';

@Module({
  controllers: [TicketsController],
  providers: [
    { provide: TicketRepository, useClass: PrismaTicketRepository },
    CreateTicketUseCase,
  ],
})
export class TicketsModule {}

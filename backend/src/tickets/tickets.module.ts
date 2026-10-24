import { Module } from '@nestjs/common';
import { AttachmentsModule } from './attachments/attachments.module';
import { CompletionFileRepository } from './application/ports/completion-file.repository';
import { TicketDetailExportWriter } from './application/ports/ticket-detail-export-writer';
import { TicketDetailExportRepository } from './application/ports/ticket-detail-export.repository';
import { TicketExportWriter } from './application/ports/ticket-export-writer';
import { TicketMessageRepository } from './application/ports/ticket-message.repository';
import { TicketQueryRepository } from './application/ports/ticket-query.repository';
import { TicketStageRepository } from './application/ports/ticket-stage.repository';
import { TicketRepository } from './application/ports/ticket.repository';
import { AdvanceTicketStageUseCase } from './application/use-cases/advance-ticket-stage.use-case';
import { CompleteTicketUseCase } from './application/use-cases/complete-ticket.use-case';
import { CreateTicketUseCase } from './application/use-cases/create-ticket.use-case';
import { DownloadCompletionFileUseCase } from './application/use-cases/download-completion-file.use-case';
import { ExportOutgoingTicketsUseCase } from './application/use-cases/export-outgoing-tickets.use-case';
import { ExportTicketDetailUseCase } from './application/use-cases/export-ticket-detail.use-case';
import { GetActionCountsUseCase } from './application/use-cases/get-action-counts.use-case';
import { GetRecentTicketsUseCase } from './application/use-cases/get-recent-tickets.use-case';
import { GetTicketByIdUseCase } from './application/use-cases/get-ticket-by-id.use-case';
import { GetTicketStatsUseCase } from './application/use-cases/get-ticket-stats.use-case';
import { ListTicketMessagesUseCase } from './application/use-cases/list-ticket-messages.use-case';
import { PostTicketCommentUseCase } from './application/use-cases/post-ticket-comment.use-case';
import { ListAllTicketsUseCase } from './application/use-cases/list-all-tickets.use-case';
import { ListIncomingTicketsUseCase } from './application/use-cases/list-incoming-tickets.use-case';
import { ListOutgoingTicketsUseCase } from './application/use-cases/list-outgoing-tickets.use-case';
import { PrismaCompletionFileRepository } from './infrastructure/prisma-completion-file.repository';
import { PrismaTicketDetailExportRepository } from './infrastructure/prisma-ticket-detail-export.repository';
import { PrismaTicketQueryRepository } from './infrastructure/prisma-ticket-query.repository';
import { PrismaTicketMessageRepository } from './infrastructure/prisma-ticket-message.repository';
import { PrismaTicketStageRepository } from './infrastructure/prisma-ticket-stage.repository';
import { PrismaTicketRepository } from './infrastructure/prisma-ticket.repository';
import { XlsxTicketDetailExportWriter } from './infrastructure/xlsx-ticket-detail-export-writer';
import { XlsxTicketExportWriter } from './infrastructure/xlsx-ticket-export-writer';
import { CompleteTargetGuard } from './presentation/complete-target.guard';
import { TicketsController } from './presentation/tickets.controller';

@Module({
  imports: [AttachmentsModule],
  controllers: [TicketsController],
  providers: [
    { provide: TicketRepository, useClass: PrismaTicketRepository },
    { provide: TicketQueryRepository, useClass: PrismaTicketQueryRepository },
    { provide: TicketStageRepository, useClass: PrismaTicketStageRepository },
    {
      provide: TicketMessageRepository,
      useClass: PrismaTicketMessageRepository,
    },
    {
      provide: CompletionFileRepository,
      useClass: PrismaCompletionFileRepository,
    },
    {
      provide: TicketDetailExportRepository,
      useClass: PrismaTicketDetailExportRepository,
    },
    { provide: TicketExportWriter, useClass: XlsxTicketExportWriter },
    {
      provide: TicketDetailExportWriter,
      useClass: XlsxTicketDetailExportWriter,
    },
    CreateTicketUseCase,
    ListOutgoingTicketsUseCase,
    ListIncomingTicketsUseCase,
    ListAllTicketsUseCase,
    GetActionCountsUseCase,
    GetTicketStatsUseCase,
    GetRecentTicketsUseCase,
    GetTicketByIdUseCase,
    AdvanceTicketStageUseCase,
    ExportOutgoingTicketsUseCase,
    ListTicketMessagesUseCase,
    PostTicketCommentUseCase,
    CompleteTicketUseCase,
    DownloadCompletionFileUseCase,
    ExportTicketDetailUseCase,
    CompleteTargetGuard,
  ],
})
export class TicketsModule {}

import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../auth/domain/auth-user';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import {
  AnyRole,
  Roles,
} from '../../auth/presentation/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { SameOriginGuard } from '../../common/guards/same-origin.guard';
import { NoStoreInterceptor } from '../../common/interceptors/no-store.interceptor';
import { attachmentDisposition } from '../attachments/presentation/content-disposition';
import {
  CreatedTicket,
  CreateTicketUseCase,
} from '../application/use-cases/create-ticket.use-case';
import {
  ActionCountsView,
  GetActionCountsUseCase,
} from '../application/use-cases/get-action-counts.use-case';
import { ExportOutgoingTicketsUseCase } from '../application/use-cases/export-outgoing-tickets.use-case';
import { GetRecentTicketsUseCase } from '../application/use-cases/get-recent-tickets.use-case';
import {
  GetTicketStatsUseCase,
  TicketStatsView,
} from '../application/use-cases/get-ticket-stats.use-case';
import {
  GetTicketByIdUseCase,
  TicketDetailView,
} from '../application/use-cases/get-ticket-by-id.use-case';
import {
  AdvancedTicket,
  AdvanceTicketStageUseCase,
} from '../application/use-cases/advance-ticket-stage.use-case';
import {
  ListTicketMessagesUseCase,
  TicketMessageView,
} from '../application/use-cases/list-ticket-messages.use-case';
import { PostTicketCommentUseCase } from '../application/use-cases/post-ticket-comment.use-case';
import { ListAllTicketsUseCase } from '../application/use-cases/list-all-tickets.use-case';
import { ListIncomingTicketsUseCase } from '../application/use-cases/list-incoming-tickets.use-case';
import { ListOutgoingTicketsUseCase } from '../application/use-cases/list-outgoing-tickets.use-case';
import {
  TicketListItemView,
  TicketListView,
} from '../application/use-cases/ticket-list-query';
import { AdvanceTicketStageDto } from './dto/advance-ticket-stage.dto';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { TicketFilterQueryDto } from './dto/ticket-filter-query.dto';
import { TicketIdParamDto } from './dto/ticket-id-param.dto';
import {
  COMMENT_THROTTLE,
  EXPORT_THROTTLE,
  STAGE_ACTION_THROTTLE,
  XLSX_CONTENT_TYPE,
} from './tickets.config';

const DIVISI_MEMBER_ROLES = [
  Role.TEAM_MAIN_OFFICE,
  Role.MANAGER_MAIN_OFFICE,
  Role.FINANCE_MAIN_OFFICE,
  Role.FINANCE_MANAGER_MAIN_OFFICE,
] as const;

@Controller('tickets')
@UseInterceptors(NoStoreInterceptor)
export class TicketsController {
  constructor(
    private readonly createTicketUseCase: CreateTicketUseCase,
    private readonly listOutgoingTickets: ListOutgoingTicketsUseCase,
    private readonly listIncomingTickets: ListIncomingTicketsUseCase,
    private readonly listAllTickets: ListAllTicketsUseCase,
    private readonly getActionCounts: GetActionCountsUseCase,
    private readonly getTicketStats: GetTicketStatsUseCase,
    private readonly getRecentTickets: GetRecentTicketsUseCase,
    private readonly getTicketById: GetTicketByIdUseCase,
    private readonly advanceTicketStage: AdvanceTicketStageUseCase,
    private readonly exportOutgoingTickets: ExportOutgoingTicketsUseCase,
    private readonly listTicketMessages: ListTicketMessagesUseCase,
    private readonly postTicketComment: PostTicketCommentUseCase,
  ) {}

  @Roles(...DIVISI_MEMBER_ROLES)
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTicketDto,
  ): Promise<CreatedTicket> {
    return this.createTicketUseCase.execute({
      creator: user,
      toDivisi: dto.toDivisi,
      description: dto.description,
    });
  }

  @Roles(...DIVISI_MEMBER_ROLES)
  @Get('outgoing')
  listOutgoing(
    @CurrentUser() user: AuthUser,
    @Query() query: ListTicketsQueryDto,
  ): Promise<TicketListView> {
    return this.listOutgoingTickets.execute({ user, ...query });
  }

  @Roles(...DIVISI_MEMBER_ROLES)
  @Throttle(EXPORT_THROTTLE)
  @UseGuards(SameOriginGuard)
  @Get('outgoing/export')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  async exportOutgoing(
    @CurrentUser() user: AuthUser,
    @Query() query: TicketFilterQueryDto,
  ): Promise<StreamableFile> {
    const file = await this.exportOutgoingTickets.execute({ user, ...query });
    return new StreamableFile(file.content, {
      type: XLSX_CONTENT_TYPE,
      length: file.content.length,
      disposition: attachmentDisposition(file.fileName),
    });
  }

  @Roles(...DIVISI_MEMBER_ROLES)
  @Get('incoming')
  listIncoming(
    @CurrentUser() user: AuthUser,
    @Query() query: ListTicketsQueryDto,
  ): Promise<TicketListView> {
    return this.listIncomingTickets.execute({ user, ...query });
  }

  @Roles(Role.SUPERADMIN)
  @Get('all')
  listAll(@Query() query: ListTicketsQueryDto): Promise<TicketListView> {
    return this.listAllTickets.execute(query);
  }

  @Roles(...DIVISI_MEMBER_ROLES)
  @Get('action-counts')
  actionCounts(@CurrentUser() user: AuthUser): Promise<ActionCountsView> {
    return this.getActionCounts.execute(user);
  }

  @Roles(...DIVISI_MEMBER_ROLES)
  @Get('stats')
  stats(@CurrentUser() user: AuthUser): Promise<TicketStatsView> {
    return this.getTicketStats.execute(user);
  }

  @Roles(...DIVISI_MEMBER_ROLES)
  @Get('recent')
  recent(@CurrentUser() user: AuthUser): Promise<TicketListItemView[]> {
    return this.getRecentTickets.execute(user);
  }

  @AnyRole()
  @Get(':id')
  detail(
    @CurrentUser() user: AuthUser,
    @Param() params: TicketIdParamDto,
  ): Promise<TicketDetailView> {
    return this.getTicketById.execute({ user, ticketId: params.id });
  }

  @Roles(...DIVISI_MEMBER_ROLES)
  @Throttle(STAGE_ACTION_THROTTLE)
  @Patch(':id/stage')
  advanceStage(
    @CurrentUser() user: AuthUser,
    @Param() params: TicketIdParamDto,
    @Body() dto: AdvanceTicketStageDto,
  ): Promise<AdvancedTicket> {
    return this.advanceTicketStage.execute({
      actor: user,
      ticketId: params.id,
      action: dto.action,
      reason: dto.reason,
    });
  }

  @AnyRole()
  @Get(':id/messages')
  messages(
    @CurrentUser() user: AuthUser,
    @Param() params: TicketIdParamDto,
  ): Promise<TicketMessageView[]> {
    return this.listTicketMessages.execute({ user, ticketId: params.id });
  }

  @AnyRole()
  @Throttle(COMMENT_THROTTLE)
  @UseGuards(SameOriginGuard)
  @Post(':id/messages')
  postMessage(
    @CurrentUser() user: AuthUser,
    @Param() params: TicketIdParamDto,
    @Body() dto: CreateTicketMessageDto,
  ): Promise<TicketMessageView> {
    return this.postTicketComment.execute({
      user,
      ticketId: params.id,
      body: dto.body,
    });
  }
}

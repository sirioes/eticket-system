import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { NoStoreInterceptor } from '../../common/interceptors/no-store.interceptor';
import {
  CreatedTicket,
  CreateTicketUseCase,
} from '../application/use-cases/create-ticket.use-case';
import {
  ActionCountsView,
  GetActionCountsUseCase,
} from '../application/use-cases/get-action-counts.use-case';
import {
  GetTicketByIdUseCase,
  TicketDetailView,
} from '../application/use-cases/get-ticket-by-id.use-case';
import {
  AdvancedTicket,
  AdvanceTicketStageUseCase,
} from '../application/use-cases/advance-ticket-stage.use-case';
import { ListIncomingTicketsUseCase } from '../application/use-cases/list-incoming-tickets.use-case';
import { ListOutgoingTicketsUseCase } from '../application/use-cases/list-outgoing-tickets.use-case';
import { TicketListView } from '../application/use-cases/ticket-list-query';
import { AdvanceTicketStageDto } from './dto/advance-ticket-stage.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { TicketIdParamDto } from './dto/ticket-id-param.dto';
import { STAGE_ACTION_THROTTLE } from './tickets.config';

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
    private readonly getActionCounts: GetActionCountsUseCase,
    private readonly getTicketById: GetTicketByIdUseCase,
    private readonly advanceTicketStage: AdvanceTicketStageUseCase,
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
  @Get('incoming')
  listIncoming(
    @CurrentUser() user: AuthUser,
    @Query() query: ListTicketsQueryDto,
  ): Promise<TicketListView> {
    return this.listIncomingTickets.execute({ user, ...query });
  }

  @Roles(...DIVISI_MEMBER_ROLES)
  @Get('action-counts')
  actionCounts(@CurrentUser() user: AuthUser): Promise<ActionCountsView> {
    return this.getActionCounts.execute(user);
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
    });
  }
}

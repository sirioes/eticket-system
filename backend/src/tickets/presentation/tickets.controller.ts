import { Body, Controller, Post } from '@nestjs/common';
import type { AuthUser } from '../../auth/domain/auth-user';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import {
  CreatedTicket,
  CreateTicketUseCase,
} from '../application/use-cases/create-ticket.use-case';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly createTicketUseCase: CreateTicketUseCase) {}

  @Roles(
    Role.TEAM_MAIN_OFFICE,
    Role.MANAGER_MAIN_OFFICE,
    Role.FINANCE_MAIN_OFFICE,
    Role.FINANCE_MANAGER_MAIN_OFFICE,
  )
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
}

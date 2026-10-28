import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthUser } from '../../auth/domain/auth-user';
import { CompleteTicketUseCase } from '../application/use-cases/complete-ticket.use-case';

@Injectable()
export class CompleteTargetGuard implements CanActivate {
  constructor(private readonly completeTicket: CompleteTicketUseCase) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ user: AuthUser; params: { id: string } }>();
    await this.completeTicket.assertCanComplete(
      request.user,
      request.params.id,
    );
    return true;
  }
}

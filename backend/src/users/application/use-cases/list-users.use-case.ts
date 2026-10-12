import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../../auth/domain/auth-user';
import { UserAdminRepository } from '../ports/user-admin.repository';

@Injectable()
export class ListUsersUseCase {
  constructor(private readonly userAdmin: UserAdminRepository) {}

  execute(): Promise<AuthUser[]> {
    return this.userAdmin.findAll();
  }
}

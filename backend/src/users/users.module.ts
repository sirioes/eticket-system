import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserAdminRepository } from './application/ports/user-admin.repository';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { ListUsersUseCase } from './application/use-cases/list-users.use-case';
import { ResetUserPasswordUseCase } from './application/use-cases/reset-user-password.use-case';
import { UpdateUserUseCase } from './application/use-cases/update-user.use-case';
import { PrismaUserAdminRepository } from './infrastructure/prisma-user-admin.repository';
import { UsersController } from './presentation/users.controller';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [
    { provide: UserAdminRepository, useClass: PrismaUserAdminRepository },
    ListUsersUseCase,
    CreateUserUseCase,
    UpdateUserUseCase,
    ResetUserPasswordUseCase,
  ],
})
export class UsersModule {}

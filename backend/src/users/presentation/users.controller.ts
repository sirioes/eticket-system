import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../auth/domain/auth-user';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { NoStoreInterceptor } from '../../common/interceptors/no-store.interceptor';
import { CreateUserUseCase } from '../application/use-cases/create-user.use-case';
import { ListUsersUseCase } from '../application/use-cases/list-users.use-case';
import { ResetUserPasswordUseCase } from '../application/use-cases/reset-user-password.use-case';
import { UpdateUserUseCase } from '../application/use-cases/update-user.use-case';
import { CreateUserDto } from './dto/create-user.dto';
import {
  ManagedUserResponse,
  toManagedUserResponse,
} from './dto/managed-user.response';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserIdParamDto } from './dto/user-id-param.dto';
import { USER_WRITE_THROTTLE } from './users.config';

@Controller('users')
@Roles(Role.SUPERADMIN)
@UseInterceptors(NoStoreInterceptor)
export class UsersController {
  constructor(
    private readonly listUsers: ListUsersUseCase,
    private readonly createUser: CreateUserUseCase,
    private readonly updateUser: UpdateUserUseCase,
    private readonly resetUserPassword: ResetUserPasswordUseCase,
  ) {}

  @Get()
  async list(): Promise<ManagedUserResponse[]> {
    const users = await this.listUsers.execute();
    return users.map(toManagedUserResponse);
  }

  @Throttle(USER_WRITE_THROTTLE)
  @Post()
  async create(@Body() dto: CreateUserDto): Promise<ManagedUserResponse> {
    const user = await this.createUser.execute({
      fullName: dto.fullName,
      role: dto.role,
      divisi: dto.divisi ?? null,
      password: dto.password,
    });
    return toManagedUserResponse(user);
  }

  @Throttle(USER_WRITE_THROTTLE)
  @Patch(':id')
  async update(
    @CurrentUser() actor: AuthUser,
    @Param() params: UserIdParamDto,
    @Body() dto: UpdateUserDto,
  ): Promise<ManagedUserResponse> {
    const user = await this.updateUser.execute({
      actor,
      userId: params.id,
      role: dto.role,
      divisi: dto.divisi,
      isActive: dto.isActive,
    });
    return toManagedUserResponse(user);
  }

  @Throttle(USER_WRITE_THROTTLE)
  @Patch(':id/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @CurrentUser() actor: AuthUser,
    @Param() params: UserIdParamDto,
    @Body() dto: ResetPasswordDto,
  ): Promise<void> {
    await this.resetUserPassword.execute({
      actorId: actor.id,
      userId: params.id,
      newPassword: dto.newPassword,
    });
  }
}

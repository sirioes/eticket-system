import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ChangePasswordUseCase } from '../application/use-cases/change-password.use-case';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { ACCESS_TOKEN_COOKIE, CHANGE_PASSWORD_THROTTLE, LOGIN_THROTTLE } from '../auth.constants';
import type { AuthUser } from '../domain/auth-user';
import { accessTokenCookieOptions } from './access-token-cookie';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { AuthUserResponse, toAuthUserResponse } from './dto/auth-user.response';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { AnyRole } from './decorators/roles.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle(LOGIN_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: AuthUserResponse }> {
    const { accessToken, user } = await this.loginUseCase.execute(dto);
    response.cookie(ACCESS_TOKEN_COOKIE, accessToken, accessTokenCookieOptions(this.config));
    return { user: toAuthUserResponse(user) };
  }

  @AnyRole()
  @Get('me')
  me(@CurrentUser() user: AuthUser): { user: AuthUserResponse } {
    return { user: toAuthUserResponse(user) };
  }

  @AnyRole()
  @Throttle(CHANGE_PASSWORD_THROTTLE)
  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const accessToken = await this.changePasswordUseCase.execute({
      userId: user.id,
      currentPassword: dto.currentPassword,
      newPassword: dto.newPassword,
    });
    response.cookie(ACCESS_TOKEN_COOKIE, accessToken, accessTokenCookieOptions(this.config));
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) response: Response): void {
    response.clearCookie(ACCESS_TOKEN_COOKIE, accessTokenCookieOptions(this.config));
  }
}
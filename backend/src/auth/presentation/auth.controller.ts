import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { ACCESS_TOKEN_COOKIE, LOGIN_THROTTLE } from '../auth.constants';
import type { AuthUser } from '../domain/auth-user';
import { accessTokenCookieOptions } from './access-token-cookie';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { AuthUserResponse, toAuthUserResponse } from './dto/auth-user.response';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
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

  @Get('me')
  me(@CurrentUser() user: AuthUser): { user: AuthUserResponse } {
    return { user: toAuthUserResponse(user) };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) response: Response): void {
    response.clearCookie(ACCESS_TOKEN_COOKIE, accessTokenCookieOptions(this.config));
  }
}
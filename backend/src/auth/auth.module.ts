import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessTokenIssuer } from './application/ports/access-token-issuer';
import { PasswordHasher } from './application/ports/password-hasher';
import { UserRepository } from './application/ports/user.repository';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { ValidateSessionUseCase } from './application/use-cases/validate-session.use-case';
import { ACCESS_TOKEN_TTL } from './auth.constants';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { JwtAccessTokenIssuer } from './infrastructure/jwt-access-token.issuer';
import { getJwtSecret } from './infrastructure/jwt-secret';
import { JwtStrategy } from './infrastructure/jwt.strategy';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { AuthController } from './presentation/auth.controller';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: getJwtSecret(config),
        signOptions: { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_TTL },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    { provide: UserRepository, useClass: PrismaUserRepository },
    { provide: PasswordHasher, useClass: BcryptPasswordHasher },
    { provide: AccessTokenIssuer, useClass: JwtAccessTokenIssuer },
    LoginUseCase,
    ValidateSessionUseCase,
    JwtStrategy,
  ],
  exports: [UserRepository],
})
export class AuthModule {}
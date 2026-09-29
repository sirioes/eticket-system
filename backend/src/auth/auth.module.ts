import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UserRepository } from './application/ports/user.repository';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';

@Module({

  imports: [PrismaModule],
  providers: [{ provide: UserRepository, useClass: PrismaUserRepository }],

  exports: [UserRepository],
})
export class AuthModule {}
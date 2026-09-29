import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRepository } from '../application/ports/user.repository';
import { AuthUser, UserCredentials } from '../domain/auth-user';
import { toAuthUser, toUserCredentials } from './user.mapper';

const AUTH_USER_SELECT = {
  id: true,
  fullName: true,
  role: true,
  divisi: true,
  isActive: true,
  passwordChangedAt: true,
} as const;

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCredentialsByFullName(
    normalizedFullName: string,
  ): Promise<UserCredentials | null> {
    const row = await this.prisma.user.findUnique({
      where: { fullName: normalizedFullName },
      select: { ...AUTH_USER_SELECT, password: true },
    });
    return row ? toUserCredentials(row) : null;
  }

  async findAuthUserById(id: number): Promise<AuthUser | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: AUTH_USER_SELECT,
    });
    return row ? toAuthUser(row) : null;
  }
}
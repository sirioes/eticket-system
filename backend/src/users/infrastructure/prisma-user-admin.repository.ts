import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../auth/domain/auth-user';
import { AUTH_USER_SELECT } from '../../auth/infrastructure/prisma-user.repository';
import { toAuthUser } from '../../auth/infrastructure/user.mapper';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DuplicateFullNameError,
  NewUser,
  UserAdminRepository,
  UserChanges,
} from '../application/ports/user-admin.repository';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class PrismaUserAdminRepository implements UserAdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<AuthUser[]> {
    const rows = await this.prisma.user.findMany({
      select: AUTH_USER_SELECT,
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toAuthUser);
  }

  async create(user: NewUser): Promise<AuthUser> {
    try {
      const row = await this.prisma.user.create({
        data: {
          fullName: user.fullName,
          password: user.passwordHash,
          role: user.role,
          divisi: user.divisi,
        },
        select: AUTH_USER_SELECT,
      });
      return toAuthUser(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new DuplicateFullNameError(user.fullName);
      }
      throw error;
    }
  }

  async update(id: number, changes: UserChanges): Promise<AuthUser> {
    const row = await this.prisma.user.update({
      where: { id },
      data: {
        role: changes.role,
        divisi: changes.divisi,
        isActive: changes.isActive,
      },
      select: AUTH_USER_SELECT,
    });
    return toAuthUser(row);
  }
}

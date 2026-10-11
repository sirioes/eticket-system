import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { Divisi } from '../../src/common/enums/divisi.enum';
import { Role } from '../../src/common/enums/role.enum';
import { TicketStage } from '../../src/generated/prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

export const TEST_PASSWORD = randomBytes(24).toString('base64url');

export function assertTestDatabase(): void {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL wajib diisi untuk test:db');

  const url = new URL(raw);
  const database = url.pathname.replace(/^\//, '');
  if (!LOCAL_HOSTS.has(url.hostname) || !database.endsWith('_test')) {
    throw new Error(
      'test:db hanya boleh berjalan pada database lokal yang namanya berakhiran _test',
    );
  }
}

export async function connectTestDatabase(): Promise<PrismaService> {
  assertTestDatabase();
  const prisma = new PrismaService();
  await prisma.$connect();
  return prisma;
}

export async function resetTickets(prisma: PrismaService): Promise<void> {
  await prisma.ticketStageLog.deleteMany();
  await prisma.ticketAttachment.deleteMany();
  await prisma.ticket.deleteMany();
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await resetTickets(prisma);
  await prisma.user.deleteMany();
}

export interface SeededUser {
  readonly id: number;
  readonly fullName: string;
  readonly role: Role;
  readonly divisi: Divisi | null;
}

export async function seedUser(
  prisma: PrismaService,
  fullName: string,
  role: Role,
  divisi: Divisi | null,
): Promise<SeededUser> {
  const user = await prisma.user.create({
    data: {
      fullName,
      password: await bcrypt.hash(TEST_PASSWORD, 4),
      role,
      divisi,
    },
    select: { id: true },
  });
  return { id: user.id, fullName, role, divisi };
}

export interface SeedTicket {
  readonly id: string;
  readonly fromDivisi: Divisi;
  readonly toDivisi: Divisi;
  readonly createdById: number;
  readonly stage?: TicketStage;
  readonly rejectedAtStage?: TicketStage | null;
  readonly createdAt?: Date;
}

export async function seedTicket(
  prisma: PrismaService,
  ticket: SeedTicket,
): Promise<void> {
  await prisma.ticket.create({
    data: {
      id: ticket.id,
      description: `Deskripsi ${ticket.id} untuk pengujian`,
      fromDivisi: ticket.fromDivisi,
      toDivisi: ticket.toDivisi,
      createdById: ticket.createdById,
      stage: ticket.stage ?? 'MENUNGGU_MANAGER_ASAL',
      rejectedAtStage: ticket.rejectedAtStage ?? null,
      ...(ticket.createdAt && { createdAt: ticket.createdAt }),
      stageLogs: {
        create: {
          action: 'DIBUAT',
          toStage: 'MENUNGGU_MANAGER_ASAL',
          actorId: ticket.createdById,
        },
      },
    },
    select: { id: true },
  });
}

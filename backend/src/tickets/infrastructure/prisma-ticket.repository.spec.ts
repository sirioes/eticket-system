import { Divisi } from '../../common/enums/divisi.enum';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DuplicateTicketIdError } from '../application/ports/ticket.repository';
import { PrismaTicketRepository } from './prisma-ticket.repository';

const newTicket = {
  id: 'IT-20261006-003',
  description: 'Printer lantai 2 tidak bisa mencetak',
  fromDivisi: Divisi.IT,
  toDivisi: Divisi.FINANCE,
  createdById: 11,
};

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('gagal', {
    code,
    clientVersion: 'test',
  });

describe('PrismaTicketRepository', () => {
  const ticketDelegate = { findFirst: jest.fn(), create: jest.fn() };
  const repository = new PrismaTicketRepository({
    ticket: ticketDelegate,
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('findLatestIdWithPrefix', () => {
    it('mengambil ID terbesar dengan prefix yang diberikan', async () => {
      ticketDelegate.findFirst.mockResolvedValue({ id: 'IT-20261006-007' });

      await expect(
        repository.findLatestIdWithPrefix('IT-20261006-'),
      ).resolves.toBe('IT-20261006-007');
      expect(ticketDelegate.findFirst).toHaveBeenCalledWith({
        where: { id: { startsWith: 'IT-20261006-' } },
        orderBy: { id: 'desc' },
        select: { id: true },
      });
    });

    it('mengembalikan null kalau belum ada tiket dengan prefix itu', async () => {
      ticketDelegate.findFirst.mockResolvedValue(null);

      await expect(
        repository.findLatestIdWithPrefix('IT-20261006-'),
      ).resolves.toBeNull();
    });
  });

  describe('insert', () => {
    it('hanya menulis lima kolom yang diizinkan beserta log DIBUAT', async () => {
      ticketDelegate.create.mockResolvedValue({ id: newTicket.id });

      await repository.insert({
        ...newTicket,
        stage: 'SELESAI',
        rejectedById: 1,
      } as typeof newTicket);

      expect(ticketDelegate.create).toHaveBeenCalledWith({
        data: {
          id: 'IT-20261006-003',
          description: 'Printer lantai 2 tidak bisa mencetak',
          fromDivisi: Divisi.IT,
          toDivisi: Divisi.FINANCE,
          createdById: 11,
          stageLogs: {
            create: {
              action: 'DIBUAT',
              toStage: 'MENUNGGU_MANAGER_ASAL',
              actorId: 11,
            },
          },
        },
        select: { id: true },
      });
    });

    it('mencatat pembuat tiket sebagai pelaku log DIBUAT, bukan data lain dari input', async () => {
      ticketDelegate.create.mockResolvedValue({ id: newTicket.id });

      await repository.insert({
        ...newTicket,
        actorId: 999,
      } as typeof newTicket);

      const { data } = ticketDelegate.create.mock.calls[0][0];
      expect(data.stageLogs.create.actorId).toBe(newTicket.createdById);
    });

    it('menerjemahkan P2002 menjadi DuplicateTicketIdError', async () => {
      ticketDelegate.create.mockRejectedValue(prismaError('P2002'));

      await expect(repository.insert(newTicket)).rejects.toThrow(
        new DuplicateTicketIdError(newTicket.id),
      );
    });

    it('tidak menelan error Prisma lain', async () => {
      const foreignKeyError = prismaError('P2003');
      ticketDelegate.create.mockRejectedValue(foreignKeyError);

      await expect(repository.insert(newTicket)).rejects.toBe(foreignKeyError);
    });

    it('tidak menelan error non-Prisma', async () => {
      const connectionError = new Error('koneksi putus');
      ticketDelegate.create.mockRejectedValue(connectionError);

      await expect(repository.insert(newTicket)).rejects.toBe(connectionError);
    });
  });
});

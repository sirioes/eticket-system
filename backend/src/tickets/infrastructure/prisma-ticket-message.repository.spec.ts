import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MessageContentionError } from '../application/ports/ticket-message.repository';
import { PrismaTicketMessageRepository } from './prisma-ticket-message.repository';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('gagal', {
    code,
    clientVersion: 'test',
  });

const command = {
  ticketId: 'IT-20261008-001',
  authorId: 12,
  body: 'Mohon dilengkapi',
  limit: 100,
};

describe('PrismaTicketMessageRepository', () => {
  const tx = {
    $queryRaw: jest.fn(),
    ticketMessage: { count: jest.fn(), create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    ticketMessage: { findMany: jest.fn() },
  };
  const repository = new PrismaTicketMessageRepository(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (work: (client: typeof tx) => Promise<unknown>) => work(tx),
    );
  });

  it('mengurutkan pesan berdasarkan waktu lalu id', async () => {
    prisma.ticketMessage.findMany.mockResolvedValue([]);

    await repository.listByTicket('IT-20261008-001');

    expect(prisma.ticketMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ticketId: 'IT-20261008-001' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    );
  });

  it('mengunci tiket, menghitung, lalu menulis komentar', async () => {
    tx.$queryRaw.mockResolvedValue([{ id: command.ticketId }]);
    tx.ticketMessage.count.mockResolvedValue(99);
    tx.ticketMessage.create.mockResolvedValue({ id: 'msg-1' });

    await expect(repository.createComment(command)).resolves.toEqual({
      id: 'msg-1',
    });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.ticketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          ticketId: command.ticketId,
          authorId: 12,
          kind: 'KOMENTAR',
          body: 'Mohon dilengkapi',
        },
      }),
    );
  });

  it('tidak menulis kalau jumlah pesan sudah mencapai batas', async () => {
    tx.$queryRaw.mockResolvedValue([{ id: command.ticketId }]);
    tx.ticketMessage.count.mockResolvedValue(100);

    await expect(repository.createComment(command)).resolves.toBeNull();
    expect(tx.ticketMessage.create).not.toHaveBeenCalled();
  });

  it.each(['P2028', 'P2034'])(
    'mengubah galat %s menjadi MessageContentionError',
    async (code) => {
      prisma.$transaction.mockRejectedValue(prismaError(code));

      await expect(repository.createComment(command)).rejects.toBeInstanceOf(
        MessageContentionError,
      );
    },
  );

  it('meneruskan galat lain', async () => {
    const failure = prismaError('P2002');
    prisma.$transaction.mockRejectedValue(failure);

    await expect(repository.createComment(command)).rejects.toBe(failure);
  });
});

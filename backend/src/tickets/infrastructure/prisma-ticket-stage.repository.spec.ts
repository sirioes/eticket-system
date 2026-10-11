import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdvanceStageCommand } from '../application/ports/ticket-stage.repository';
import { PrismaTicketStageRepository } from './prisma-ticket-stage.repository';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('gagal', {
    code,
    clientVersion: 'test',
  });

const accept: AdvanceStageCommand = {
  ticketId: 'IT-20261008-001',
  expectedStage: 'MENUNGGU_MANAGER_ASAL',
  action: 'TERIMA',
  nextStage: 'MENUNGGU_MANAGER_TUJUAN',
  actorId: 21,
};

const reject: AdvanceStageCommand = {
  ...accept,
  expectedStage: 'MENUNGGU_MANAGER_TUJUAN',
  action: 'TOLAK',
  nextStage: 'DITOLAK',
};

describe('PrismaTicketStageRepository', () => {
  const tx = {
    ticket: { updateMany: jest.fn() },
    ticketStageLog: { create: jest.fn() },
  };
  const prisma = { $transaction: jest.fn() };
  const repository = new PrismaTicketStageRepository(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (work: (client: typeof tx) => Promise<boolean>) => work(tx),
    );
  });

  it('mengubah tahap hanya kalau tahap saat ini masih sesuai dan mencatat log', async () => {
    tx.ticket.updateMany.mockResolvedValue({ count: 1 });
    tx.ticketStageLog.create.mockResolvedValue({ id: 'log-1' });

    await expect(repository.advanceStage(accept)).resolves.toBe(true);

    expect(tx.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: 'IT-20261008-001', stage: 'MENUNGGU_MANAGER_ASAL' },
      data: { stage: 'MENUNGGU_MANAGER_TUJUAN' },
    });
    expect(tx.ticketStageLog.create).toHaveBeenCalledWith({
      data: {
        ticketId: 'IT-20261008-001',
        action: 'TERIMA',
        fromStage: 'MENUNGGU_MANAGER_ASAL',
        toStage: 'MENUNGGU_MANAGER_TUJUAN',
        actorId: 21,
      },
      select: { id: true },
    });
  });

  it('menyimpan tahap dan pelaku penolakan saat TOLAK', async () => {
    tx.ticket.updateMany.mockResolvedValue({ count: 1 });
    tx.ticketStageLog.create.mockResolvedValue({ id: 'log-1' });

    await expect(repository.advanceStage(reject)).resolves.toBe(true);

    expect(tx.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: 'IT-20261008-001', stage: 'MENUNGGU_MANAGER_TUJUAN' },
      data: {
        stage: 'DITOLAK',
        rejectedAtStage: 'MENUNGGU_MANAGER_TUJUAN',
        rejectedById: 21,
      },
    });
  });

  it('tidak menyimpan data penolakan untuk aksi selain TOLAK', async () => {
    tx.ticket.updateMany.mockResolvedValue({ count: 1 });
    tx.ticketStageLog.create.mockResolvedValue({ id: 'log-1' });

    await repository.advanceStage({
      ...accept,
      expectedStage: 'DIPROSES',
      action: 'SELESAI',
      nextStage: 'SELESAI',
    });

    const { data } = tx.ticket.updateMany.mock.calls[0][0];
    expect(data).toEqual({ stage: 'SELESAI' });
  });

  it('mengembalikan false tanpa menulis log kalau tahap sudah berubah', async () => {
    tx.ticket.updateMany.mockResolvedValue({ count: 0 });

    await expect(repository.advanceStage(accept)).resolves.toBe(false);
    expect(tx.ticketStageLog.create).not.toHaveBeenCalled();
  });

  it('mengembalikan false kalau log untuk tahap itu sudah ada (P2002)', async () => {
    prisma.$transaction.mockRejectedValue(prismaError('P2002'));

    await expect(repository.advanceStage(accept)).resolves.toBe(false);
  });

  it('tidak menelan error Prisma lain', async () => {
    const foreignKeyError = prismaError('P2003');
    prisma.$transaction.mockRejectedValue(foreignKeyError);

    await expect(repository.advanceStage(accept)).rejects.toBe(foreignKeyError);
  });

  it('tidak menelan error non-Prisma', async () => {
    const connectionError = new Error('koneksi putus');
    prisma.$transaction.mockRejectedValue(connectionError);

    await expect(repository.advanceStage(accept)).rejects.toBe(connectionError);
  });

  it('menjalankan transaksi dengan batas waktu dan isolasi READ COMMITTED', async () => {
    tx.ticket.updateMany.mockResolvedValue({ count: 0 });

    await repository.advanceStage(accept);

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 5_000,
      timeout: 10_000,
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  });
});
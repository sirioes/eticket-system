import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { UploadContentionError } from '../application/ports/attachment.repository';
import { PrismaAttachmentRepository } from './prisma-attachment.repository';

function build() {
  const tx = {
    $queryRaw: jest
      .fn()
      .mockResolvedValue([{ stage: 'MENUNGGU_MANAGER_ASAL' }]),
    ticketAttachment: { count: jest.fn(), create: jest.fn() },
  };
  const prisma = {
    ticket: { findFirst: jest.fn() },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  return {
    tx,
    prisma,
    repository: new PrismaAttachmentRepository(
      prisma as unknown as PrismaService,
    ),
  };
}

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('x', {
    code,
    clientVersion: 'test',
  });

describe('PrismaAttachmentRepository', () => {
  describe('findUploadTarget', () => {
    it('reads stage and attachment count of a ticket the uploader owns', async () => {
      const { repository, prisma } = build();
      prisma.ticket.findFirst.mockResolvedValue({
        stage: 'MENUNGGU_MANAGER_ASAL',
        _count: { attachments: 3 },
      });

      await expect(repository.findUploadTarget('IT-1', 3)).resolves.toEqual({
        stage: 'MENUNGGU_MANAGER_ASAL',
        attachmentCount: 3,
      });
      expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
        where: { id: 'IT-1', createdById: 3 },
        select: { stage: true, _count: { select: { attachments: true } } },
      });
    });

    it('returns null when the ticket is missing or belongs to someone else', async () => {
      const { repository, prisma } = build();
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(repository.findUploadTarget('IT-9', 3)).resolves.toBeNull();
    });
  });

  describe('withLockedTicket', () => {
    it('takes the row lock as the very first statement, scoped to the owner', async () => {
      const { repository, tx } = build();
      tx.ticketAttachment.count.mockResolvedValue(0);

      await repository.withLockedTicket('IT-1', 3, async (ticket) => {
        await ticket.countAttachments();
        return {};
      });

      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      const [strings, ...values] = tx.$queryRaw.mock.calls[0] as [
        string[],
        ...unknown[],
      ];
      const sql = strings.join('?');
      expect(sql).toMatch(/FROM Ticket/);
      expect(sql).toMatch(/WHERE id = \? AND createdById = \?/);
      expect(sql).toMatch(/FOR UPDATE\s*$/);
      expect(values).toEqual(['IT-1', 3]);
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.ticketAttachment.count.mock.invocationCallOrder[0],
      );
    });

    it('uses read committed with explicit wait limits', async () => {
      const { repository, prisma } = build();

      await repository.withLockedTicket('IT-1', 3, async () => ({}));

      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        maxWait: 5_000,
        timeout: 10_000,
        isolationLevel: 'ReadCommitted',
      });
    });

    it('hands the freshly locked stage to the work', async () => {
      const { repository, tx } = build();
      tx.$queryRaw.mockResolvedValue([{ stage: 'DIPROSES' }]);

      const seen = await repository.withLockedTicket('IT-1', 3, async (t) => ({
        stage: t.stage,
      }));

      expect(seen).toEqual({ stage: 'DIPROSES' });
    });

    it('returns null without running the work when the ticket is missing or not owned', async () => {
      const { repository, tx } = build();
      tx.$queryRaw.mockResolvedValue([]);
      const work = jest.fn();

      await expect(
        repository.withLockedTicket('IT-9', 3, work),
      ).resolves.toBeNull();
      expect(work).not.toHaveBeenCalled();
      expect(tx.ticketAttachment.create).not.toHaveBeenCalled();
    });

    it('returns what the work returns and runs in one transaction', async () => {
      const { repository, prisma } = build();
      await expect(
        repository.withLockedTicket('IT-1', 3, async () => ({ ok: true })),
      ).resolves.toEqual({ ok: true });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('propagates errors from the work so the transaction rolls back', async () => {
      const { repository } = build();
      await expect(
        repository.withLockedTicket('IT-1', 3, async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
    });

    it.each(['P2028', 'P2034'])(
      'turns Prisma error %s into a retryable contention error',
      async (code) => {
        const { repository, prisma } = build();
        (prisma.$transaction as jest.Mock).mockRejectedValue(prismaError(code));

        await expect(
          repository.withLockedTicket('IT-1', 3, async () => ({})),
        ).rejects.toBeInstanceOf(UploadContentionError);
      },
    );

    it('leaves other Prisma errors alone', async () => {
      const { repository, prisma } = build();
      const other = prismaError('P2002');
      (prisma.$transaction as jest.Mock).mockRejectedValue(other);

      await expect(
        repository.withLockedTicket('IT-1', 3, async () => ({})),
      ).rejects.toBe(other);
    });

    it('counts attachments scoped to the ticket', async () => {
      const { repository, tx } = build();
      tx.ticketAttachment.count.mockResolvedValue(2);

      const result = await repository.withLockedTicket(
        'IT-1',
        3,
        async (ticket) => ({ count: await ticket.countAttachments() }),
      );

      expect(result).toEqual({ count: 2 });
      expect(tx.ticketAttachment.count).toHaveBeenCalledWith({
        where: { ticketId: 'IT-1' },
      });
    });

    it('inserts with explicit fields and never returns the stored name', async () => {
      const { repository, tx } = build();
      tx.ticketAttachment.create.mockResolvedValue({
        id: 'att-1',
        fileName: 'a.png',
        mimeType: 'image/png',
        size: 10,
      });

      const saved = await repository.withLockedTicket('IT-1', 3, (ticket) =>
        ticket.insert({
          fileName: 'a.png',
          storedName: 'uuid',
          mimeType: 'image/png',
          size: 10,
          uploadedById: 4,
        }),
      );

      expect(tx.ticketAttachment.create).toHaveBeenCalledWith({
        data: {
          ticketId: 'IT-1',
          fileName: 'a.png',
          storedName: 'uuid',
          mimeType: 'image/png',
          size: 10,
          uploadedById: 4,
        },
        select: { id: true, fileName: true, mimeType: true, size: true },
      });
      expect(saved).not.toHaveProperty('storedName');
    });
  });
});

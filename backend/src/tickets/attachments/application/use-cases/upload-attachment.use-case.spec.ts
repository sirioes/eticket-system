import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TicketStage } from '../../../../generated/prisma/client';
import { AuthUser } from '../../../../auth/domain/auth-user';
import { Divisi } from '../../../../common/enums/divisi.enum';
import { Role } from '../../../../common/enums/role.enum';
import {
  MAX_ATTACHMENTS_PER_TICKET,
  UNSUPPORTED_FILE_TYPE_MESSAGE,
} from '../../domain/attachment-rules';
import { AttachmentFileStore } from '../ports/attachment-file-store';
import {
  AttachmentRepository,
  LockedTicket,
  NewAttachment,
  UploadContentionError,
  UploadTarget,
} from '../ports/attachment.repository';
import {
  ATTACHMENT_LIMIT_MESSAGE,
  STAGE_LOCKED_MESSAGE,
  TICKET_NOT_FOUND_MESSAGE,
  UPLOAD_BUSY_MESSAGE,
  UploadAttachmentCommand,
  UploadAttachmentUseCase,
} from './upload-attachment.use-case';

const uploader: AuthUser = {
  id: 7,
  fullName: 'Staf IT IT01',
  role: Role.TEAM_MAIN_OFFICE,
  divisi: Divisi.IT,
  isActive: true,
  passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
};

interface FakeTicket {
  createdById: number;
  stage: TicketStage;
  attachments: number;
}

class FakeAttachmentRepository extends AttachmentRepository {
  readonly inserted: NewAttachment[] = [];
  locked = 0;
  lockedFor: number | null = null;

  constructor(private readonly ticket: FakeTicket | null) {
    super();
  }

  async findUploadTarget(
    _ticketId: string,
    uploaderId: number,
  ): Promise<UploadTarget | null> {
    if (!this.ticket || this.ticket.createdById !== uploaderId) return null;
    return {
      stage: this.ticket.stage,
      attachmentCount: this.ticket.attachments,
    };
  }

  async withLockedTicket<T extends object>(
    _ticketId: string,
    uploaderId: number,
    work: (ticket: LockedTicket) => Promise<T>,
  ): Promise<T | null> {
    this.locked += 1;
    this.lockedFor = uploaderId;
    const ticket = this.ticket;
    if (!ticket || ticket.createdById !== uploaderId) return null;
    return work({
      stage: ticket.stage,
      countAttachments: async () => ticket.attachments + this.inserted.length,
      insert: async (attachment) => {
        this.inserted.push(attachment);
        return {
          id: 'att-1',
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          size: attachment.size,
        };
      },
    });
  }
}

class FakeFileStore extends AttachmentFileStore {
  readonly removed: string[] = [];
  removeError: Error | null = null;

  constructor(private readonly detected: string | null) {
    super();
  }

  async detectMimeType() {
    return this.detected;
  }

  async remove(storedName: string) {
    if (this.removeError) throw this.removeError;
    this.removed.push(storedName);
  }
}

const command = (
  overrides: Partial<UploadAttachmentCommand['file']> = {},
): UploadAttachmentCommand => ({
  uploader,
  ticketId: 'IT-20261006-001',
  file: {
    storedName: 'abc',
    originalName: 'bukti.png',
    size: 1234,
    ...overrides,
  },
});

const ownTicket = (overrides: Partial<FakeTicket> = {}): FakeTicket => ({
  createdById: uploader.id,
  stage: 'MENUNGGU_MANAGER_ASAL',
  attachments: 0,
  ...overrides,
});

async function expectRejection(
  promise: Promise<unknown>,
  type: new (...args: never[]) => Error,
  message: string,
) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(type);
  expect((error as Error).message).toBe(message);
}

describe('UploadAttachmentUseCase', () => {
  const build = (ticket: FakeTicket | null, detected: string | null) => {
    const repository = new FakeAttachmentRepository(ticket);
    const store = new FakeFileStore(detected);
    return {
      repository,
      store,
      useCase: new UploadAttachmentUseCase(repository, store),
    };
  };

  it('stores the attachment using the detected type and keeps the file', async () => {
    const { useCase, repository, store } = build(ownTicket(), 'image/png');

    const result = await useCase.execute(command());

    expect(result).toEqual({
      id: 'att-1',
      fileName: 'bukti.png',
      mimeType: 'image/png',
      size: 1234,
    });
    expect(repository.inserted).toEqual([
      {
        fileName: 'bukti.png',
        storedName: 'abc',
        mimeType: 'image/png',
        size: 1234,
        uploadedById: uploader.id,
      },
    ]);
    expect(store.removed).toEqual([]);
    expect(repository.lockedFor).toBe(uploader.id);
  });

  it('accepts an animated png that a browser sends as image/png', async () => {
    const { useCase, repository, store } = build(ownTicket(), 'image/apng');

    const result = await useCase.execute(command());

    expect(result.mimeType).toBe('image/png');
    expect(repository.inserted[0].mimeType).toBe('image/png');
    expect(store.removed).toEqual([]);
  });

  it('still rejects an animated png named like another type', async () => {
    const { useCase, store } = build(ownTicket(), 'image/apng');

    await expectRejection(
      useCase.execute(command({ originalName: 'animasi.pdf' })),
      BadRequestException,
      UNSUPPORTED_FILE_TYPE_MESSAGE,
    );
    expect(store.removed).toEqual(['abc']);
  });

  it.each([
    ['image/jpeg', 'foto.JPG'],
    ['image/jpeg', 'foto.jpeg'],
    ['application/pdf', 'nota.pdf'],
    ['image/webp', 'foto.webp'],
  ])('trusts the content: %s named %s is accepted', async (detected, name) => {
    const { useCase, repository } = build(ownTicket(), detected);

    const result = await useCase.execute(command({ originalName: name }));

    expect(result.mimeType).toBe(detected);
    expect(repository.inserted).toHaveLength(1);
  });

  it('sanitizes the display name but never changes the stored name', async () => {
    const { useCase, repository } = build(ownTicket(), 'image/png');

    await useCase.execute(command({ originalName: '../../x\r\n.png' }));

    expect(repository.inserted[0].fileName).toBe('x.png');
    expect(repository.inserted[0].storedName).toBe('abc');
  });

  it('accepts the 5th attachment', async () => {
    const { useCase } = build(
      ownTicket({ attachments: MAX_ATTACHMENTS_PER_TICKET - 1 }),
      'image/png',
    );
    await expect(useCase.execute(command())).resolves.toBeDefined();
  });

  describe('rejections remove the file from disk', () => {
    it.each([
      ['unrecognized content', null],
      ['an executable', 'application/x-msdownload'],
      ['an allowed type that differs from the file name', 'application/pdf'],
      ['a type outside the allowlist', 'image/gif'],
    ])('content check: %s', async (_label, detected) => {
      const { useCase, store, repository } = build(ownTicket(), detected);

      await expectRejection(
        useCase.execute(command()),
        BadRequestException,
        UNSUPPORTED_FILE_TYPE_MESSAGE,
      );

      expect(store.removed).toEqual(['abc']);
      expect(repository.locked).toBe(0);
    });

    it('missing ticket', async () => {
      const { useCase, store } = build(null, 'image/png');
      await expectRejection(
        useCase.execute(command()),
        NotFoundException,
        TICKET_NOT_FOUND_MESSAGE,
      );
      expect(store.removed).toEqual(['abc']);
    });

    it("someone else's ticket looks exactly like a missing one", async () => {
      const { useCase, store, repository } = build(
        ownTicket({ createdById: uploader.id + 1 }),
        'image/png',
      );
      await expectRejection(
        useCase.execute(command()),
        NotFoundException,
        TICKET_NOT_FOUND_MESSAGE,
      );
      expect(store.removed).toEqual(['abc']);
      expect(repository.inserted).toHaveLength(0);
    });

    it.each([
      'MENUNGGU_MANAGER_TUJUAN',
      'MENUNGGU_STAF_TUJUAN',
      'DIPROSES',
      'SELESAI',
      'DITOLAK',
    ] as const)('stage %s', async (stage) => {
      const { useCase, store, repository } = build(
        ownTicket({ stage }),
        'image/png',
      );
      await expectRejection(
        useCase.execute(command()),
        ConflictException,
        STAGE_LOCKED_MESSAGE,
      );
      expect(store.removed).toEqual(['abc']);
      expect(repository.inserted).toHaveLength(0);
    });

    it('6th attachment', async () => {
      const { useCase, store, repository } = build(
        ownTicket({ attachments: MAX_ATTACHMENTS_PER_TICKET }),
        'image/png',
      );
      await expectRejection(
        useCase.execute(command()),
        ConflictException,
        ATTACHMENT_LIMIT_MESSAGE,
      );
      expect(store.removed).toEqual(['abc']);
      expect(repository.inserted).toHaveLength(0);
    });

    it('lock wait that ran out becomes a retryable 409', async () => {
      const { useCase, store, repository } = build(ownTicket(), 'image/png');
      jest
        .spyOn(repository, 'withLockedTicket')
        .mockRejectedValueOnce(new UploadContentionError());

      await expectRejection(
        useCase.execute(command()),
        ConflictException,
        UPLOAD_BUSY_MESSAGE,
      );
      expect(store.removed).toEqual(['abc']);
    });

    it('unexpected failure while saving', async () => {
      const { useCase, store, repository } = build(ownTicket(), 'image/png');
      jest
        .spyOn(repository, 'withLockedTicket')
        .mockRejectedValueOnce(new Error('db down'));
      await expect(useCase.execute(command())).rejects.toThrow('db down');
      expect(store.removed).toEqual(['abc']);
    });
  });

  describe('assertCanUpload (early check before the body is read)', () => {
    it('passes for the creator of a ticket that still accepts attachments', async () => {
      const { useCase, repository } = build(ownTicket(), null);

      await expect(
        useCase.assertCanUpload(uploader, 'IT-1'),
      ).resolves.toBeUndefined();
      expect(repository.locked).toBe(0);
    });

    it('answers 404 for a missing ticket and for someone elses alike', async () => {
      const missing = build(null, null);
      const foreign = build(ownTicket({ createdById: uploader.id + 1 }), null);

      for (const { useCase } of [missing, foreign]) {
        await expectRejection(
          useCase.assertCanUpload(uploader, 'IT-1'),
          NotFoundException,
          TICKET_NOT_FOUND_MESSAGE,
        );
      }
    });

    it.each([
      'MENUNGGU_MANAGER_TUJUAN',
      'MENUNGGU_STAF_TUJUAN',
      'DIPROSES',
      'SELESAI',
      'DITOLAK',
    ] as const)('answers 409 for stage %s', async (stage) => {
      const { useCase } = build(ownTicket({ stage }), null);
      await expectRejection(
        useCase.assertCanUpload(uploader, 'IT-1'),
        ConflictException,
        STAGE_LOCKED_MESSAGE,
      );
    });

    it('answers 409 when the ticket already has the maximum', async () => {
      const { useCase } = build(
        ownTicket({ attachments: MAX_ATTACHMENTS_PER_TICKET }),
        null,
      );
      await expectRejection(
        useCase.assertCanUpload(uploader, 'IT-1'),
        ConflictException,
        ATTACHMENT_LIMIT_MESSAGE,
      );
    });
  });

  it('reports the original error even if cleanup fails', async () => {
    const { useCase, store } = build(null, 'image/png');
    store.removeError = new Error('disk gone');
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    await expectRejection(
      useCase.execute(command()),
      NotFoundException,
      TICKET_NOT_FOUND_MESSAGE,
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('disk gone'));
    warn.mockRestore();
  });
});

import { Logger, NotFoundException } from '@nestjs/common';
import { Readable } from 'node:stream';
import { AuthUser } from '../../../../auth/domain/auth-user';
import { Divisi } from '../../../../common/enums/divisi.enum';
import { Role } from '../../../../common/enums/role.enum';
import {
  AttachmentFileStore,
  OpenedFile,
} from '../ports/attachment-file-store';
import {
  AttachmentRepository,
  DownloadableAttachment,
} from '../ports/attachment.repository';
import {
  ATTACHMENT_NOT_FOUND_MESSAGE,
  DownloadAttachmentUseCase,
  FALLBACK_MIME_TYPE,
} from './download-attachment.use-case';

const user = (role: Role, divisi: Divisi | null): AuthUser => ({
  id: 1,
  fullName: 'Pengguna Uji',
  role,
  divisi,
  isActive: true,
  passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
});

const owner = user(Role.TEAM_MAIN_OFFICE, Divisi.IT);
const outsider = user(Role.TEAM_MAIN_OFFICE, Divisi.LEGAL);

const attachment = (
  overrides: Partial<DownloadableAttachment> = {},
): DownloadableAttachment => ({
  fileName: 'laporan.pdf',
  storedName: '3f2b8c1e-5a47-4d9b-8e60-1c2d3e4f5a6b',
  mimeType: 'application/pdf',
  ticket: {
    fromDivisi: Divisi.IT,
    toDivisi: Divisi.TAX,
    stage: 'MENUNGGU_MANAGER_ASAL',
    rejectedAtStage: null,
  },
  ...overrides,
});

class FakeRepository extends AttachmentRepository {
  constructor(private readonly found: DownloadableAttachment | null) {
    super();
  }

  async findForDownload() {
    return this.found;
  }

  async findUploadTarget() {
    return null;
  }

  async withLockedTicket() {
    return null;
  }
}

class FakeFileStore extends AttachmentFileStore {
  readonly opened: string[] = [];

  constructor(private readonly file: OpenedFile | null) {
    super();
  }

  async open(storedName: string) {
    this.opened.push(storedName);
    return this.file;
  }

  async detectMimeType() {
    return null;
  }

  async remove() {}
}

const stream = () => Readable.from([Buffer.from('isi')]);
const query = (who: AuthUser) => ({
  user: who,
  ticketId: 'IT-20261006-001',
  attachmentId: 'att-1',
});

describe('DownloadAttachmentUseCase', () => {
  let errorLog: jest.SpyInstance;

  beforeEach(() => {
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  const build = (
    found: DownloadableAttachment | null,
    file: OpenedFile | null = { stream: stream(), size: 3 },
  ) => {
    const files = new FakeFileStore(file);
    return {
      files,
      useCase: new DownloadAttachmentUseCase(new FakeRepository(found), files),
    };
  };

  it('returns the file for someone allowed to view the ticket', async () => {
    const file = { stream: stream(), size: 3 };
    const { useCase, files } = build(attachment(), file);

    await expect(useCase.execute(query(owner))).resolves.toEqual({
      fileName: 'laporan.pdf',
      mimeType: 'application/pdf',
      size: 3,
      stream: file.stream,
    });
    expect(files.opened).toEqual(['3f2b8c1e-5a47-4d9b-8e60-1c2d3e4f5a6b']);
  });

  it('answers 404 without touching the disk when the attachment is unknown', async () => {
    const { useCase, files } = build(null);

    await expect(useCase.execute(query(owner))).rejects.toThrow(
      new NotFoundException(ATTACHMENT_NOT_FOUND_MESSAGE),
    );
    expect(files.opened).toEqual([]);
  });

  it('answers the same 404 without touching the disk when the user may not view the ticket', async () => {
    const { useCase, files } = build(attachment());

    await expect(useCase.execute(query(outsider))).rejects.toThrow(
      new NotFoundException(ATTACHMENT_NOT_FOUND_MESSAGE),
    );
    expect(files.opened).toEqual([]);
  });

  it('answers 404 and logs an error when the file is missing from storage', async () => {
    const { useCase } = build(attachment(), null);

    await expect(useCase.execute(query(owner))).rejects.toThrow(
      new NotFoundException(ATTACHMENT_NOT_FOUND_MESSAGE),
    );
    expect(errorLog).toHaveBeenCalledTimes(1);
  });

  it('serves an unexpected stored type as an opaque download', async () => {
    const { useCase } = build(attachment({ mimeType: 'text/html' }));

    const result = await useCase.execute(query(owner));

    expect(result.mimeType).toBe(FALLBACK_MIME_TYPE);
  });
});

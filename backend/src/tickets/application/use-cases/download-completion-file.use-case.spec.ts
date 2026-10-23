import { Logger, NotFoundException } from '@nestjs/common';
import { Readable } from 'node:stream';
import { AuthUser } from '../../../auth/domain/auth-user';
import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';
import {
  AttachmentFileStore,
  OpenedFile,
} from '../../attachments/application/ports/attachment-file-store';
import { FALLBACK_MIME_TYPE } from '../../attachments/application/use-cases/download-attachment.use-case';
import {
  CompletionFileRepository,
  DownloadableCompletionFile,
} from '../ports/completion-file.repository';
import {
  COMPLETION_FILE_NOT_FOUND_MESSAGE,
  DownloadCompletionFileUseCase,
} from './download-completion-file.use-case';

const user = (role: Role, divisi: Divisi | null): AuthUser => ({
  id: 1,
  fullName: 'Pengguna Uji',
  role,
  divisi,
  isActive: true,
  passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
});

const staffIt = user(Role.TEAM_MAIN_OFFICE, Divisi.IT);
const staffTax = user(Role.TEAM_MAIN_OFFICE, Divisi.TAX);
const staffLegal = user(Role.TEAM_MAIN_OFFICE, Divisi.LEGAL);
const superadmin = user(Role.SUPERADMIN, null);

const record = (
  overrides: Partial<DownloadableCompletionFile> = {},
): DownloadableCompletionFile => ({
  fileName: 'LPJ.xlsx',
  storedName: '3f2b8c1e-5a47-4d9b-8e60-1c2d3e4f5a6b',
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ticket: {
    fromDivisi: Divisi.IT,
    toDivisi: Divisi.TAX,
    stage: 'SELESAI',
    rejectedAtStage: null,
  },
  ...overrides,
});

class FakeRepository extends CompletionFileRepository {
  constructor(private readonly found: DownloadableCompletionFile | null) {
    super();
  }

  async findForDownload() {
    return this.found;
  }
}

class FakeFileStore extends AttachmentFileStore {
  readonly opened: string[] = [];

  constructor(private readonly file: OpenedFile | null) {
    super();
  }

  async detectMimeType() {
    return null;
  }

  async open(storedName: string) {
    this.opened.push(storedName);
    return this.file;
  }

  async remove() {
    return;
  }
}

const query = (actor: AuthUser) => ({
  user: actor,
  ticketId: 'IT-20261011-0001',
  fileId: '0b6f4e4e-0d6e-4c2d-9a63-3a2f0f5f8f11',
});

const open = (): OpenedFile => ({
  stream: Readable.from(['isi']),
  size: 3,
});

describe('DownloadCompletionFileUseCase', () => {
  it.each([
    ['staf divisi asal', staffIt],
    ['staf divisi tujuan', staffTax],
    ['superadmin', superadmin],
  ])('membuka berkas untuk %s', async (_label, actor) => {
    const files = new FakeFileStore(open());
    const useCase = new DownloadCompletionFileUseCase(
      new FakeRepository(record()),
      files,
    );

    const result = await useCase.execute(query(actor));

    expect(result).toMatchObject({
      fileName: 'LPJ.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 3,
    });
    expect(files.opened).toEqual(['3f2b8c1e-5a47-4d9b-8e60-1c2d3e4f5a6b']);
  });

  it('404 untuk pengguna yang tidak dapat membuka tiket tanpa menyentuh disk', async () => {
    const files = new FakeFileStore(open());
    const useCase = new DownloadCompletionFileUseCase(
      new FakeRepository(record()),
      files,
    );

    await expect(useCase.execute(query(staffLegal))).rejects.toThrow(
      new NotFoundException(COMPLETION_FILE_NOT_FOUND_MESSAGE),
    );
    expect(files.opened).toEqual([]);
  });

  it('404 untuk berkas yang tidak ada', async () => {
    const useCase = new DownloadCompletionFileUseCase(
      new FakeRepository(null),
      new FakeFileStore(open()),
    );

    await expect(useCase.execute(query(staffTax))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('404 dan mencatat error bila berkas hilang dari penyimpanan', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const useCase = new DownloadCompletionFileUseCase(
      new FakeRepository(record()),
      new FakeFileStore(null),
    );

    await expect(useCase.execute(query(staffTax))).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it('memakai tipe cadangan untuk tipe tersimpan yang tidak dikenal', async () => {
    const useCase = new DownloadCompletionFileUseCase(
      new FakeRepository(record({ mimeType: 'text/html' })),
      new FakeFileStore(open()),
    );

    const result = await useCase.execute(query(staffTax));

    expect(result.mimeType).toBe(FALLBACK_MIME_TYPE);
  });
});

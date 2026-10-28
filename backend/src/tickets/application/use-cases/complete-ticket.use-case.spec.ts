import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../../../auth/domain/auth-user';
import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';
import { TicketStage } from '../../../generated/prisma/client';
import { AttachmentFileStore } from '../../attachments/application/ports/attachment-file-store';
import {
  COMPLETION_FILE_SIZE_MESSAGE,
  UNSUPPORTED_COMPLETION_FILE_MESSAGE,
} from '../../domain/completion-file-rules';
import type { VisibleTicket } from '../../domain/ticket-visibility';
import { TicketQueryRepository } from '../ports/ticket-query.repository';
import {
  AdvanceStageCommand,
  TicketStageRepository,
} from '../ports/ticket-stage.repository';
import {
  ACTION_NOT_AVAILABLE_MESSAGE,
  NOT_AUTHORIZED_ACTOR_MESSAGE,
  STAGE_CHANGED_MESSAGE,
} from './advance-ticket-stage.use-case';
import {
  COMPLETION_FILE_LIMIT_MESSAGE,
  CompleteTicketUseCase,
  UploadedCompletionFile,
} from './complete-ticket.use-case';

const XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const user = (role: Role, divisi: Divisi | null): AuthUser => ({
  id: 7,
  fullName: 'Pengguna Uji',
  role,
  divisi,
  isActive: true,
  passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
});

const staffTax = user(Role.TEAM_MAIN_OFFICE, Divisi.TAX);
const managerTax = user(Role.MANAGER_MAIN_OFFICE, Divisi.TAX);
const staffIt = user(Role.TEAM_MAIN_OFFICE, Divisi.IT);
const staffLegal = user(Role.TEAM_MAIN_OFFICE, Divisi.LEGAL);
const superadmin = user(Role.SUPERADMIN, null);

const ticketAt = (stage: TicketStage): VisibleTicket => ({
  fromDivisi: Divisi.IT,
  toDivisi: Divisi.TAX,
  stage,
  rejectedAtStage: null,
});

const stored = (n: number) => `3f2b8c1e-5a47-4d9b-8e60-1c2d3e4f5a6${n}`;

const upload = (
  n: number,
  originalName = `dokumen-${n}.pdf`,
): UploadedCompletionFile => ({
  storedName: stored(n),
  originalName,
  size: 1000 + n,
});

class FakeQueries extends TicketQueryRepository {
  constructor(private readonly ticket: VisibleTicket | null) {
    super();
  }

  async findVisibilityById() {
    return this.ticket;
  }

  async findDetailById() {
    return null;
  }
  async listOutgoing() {
    return { items: [], total: 0 };
  }
  async listIncoming() {
    return { items: [], total: 0 };
  }
  async listAll() {
    return { items: [], total: 0 };
  }
  async countOutgoingInStages() {
    return 0;
  }
  async countIncomingInStages() {
    return 0;
  }
  async countOutgoing() {
    return 0;
  }
  async countIncoming() {
    return 0;
  }
  async listRecent() {
    return [];
  }
  async findOutgoingForExport() {
    return [];
  }
}

class FakeStages extends TicketStageRepository {
  readonly commands: AdvanceStageCommand[] = [];

  constructor(private readonly result: boolean) {
    super();
  }

  async advanceStage(command: AdvanceStageCommand) {
    this.commands.push(command);
    return this.result;
  }
}

class FakeFiles extends AttachmentFileStore {
  readonly removed: string[] = [];

  constructor(private readonly detected: Record<string, string | null>) {
    super();
  }

  async detectMimeType(storedName: string) {
    return this.detected[storedName] ?? null;
  }

  async open() {
    return null;
  }

  async remove(storedName: string) {
    this.removed.push(storedName);
  }
}

const setup = (options: {
  ticket?: VisibleTicket | null;
  advanced?: boolean;
  detected?: Record<string, string | null>;
}) => {
  const stages = new FakeStages(options.advanced ?? true);
  const files = new FakeFiles(options.detected ?? {});
  const useCase = new CompleteTicketUseCase(
    new FakeQueries(
      options.ticket === undefined ? ticketAt('DIPROSES') : options.ticket,
    ),
    stages,
    files,
  );
  return { useCase, stages, files };
};

describe('CompleteTicketUseCase', () => {
  describe('tanpa dokumen', () => {
    it('menyelesaikan tiket dengan daftar file kosong', async () => {
      const { useCase, stages } = setup({});

      await expect(
        useCase.execute({ actor: staffTax, ticketId: 'T-1', files: [] }),
      ).resolves.toEqual({ id: 'T-1', stage: 'SELESAI' });

      expect(stages.commands).toEqual([
        {
          ticketId: 'T-1',
          expectedStage: 'DIPROSES',
          action: 'SELESAI',
          nextStage: 'SELESAI',
          actorId: 7,
          reason: null,
          completionFiles: [],
        },
      ]);
    });
  });

  describe('dengan dokumen', () => {
    it('menyimpan semua dokumen dengan tipe hasil deteksi dan nama aman', async () => {
      const { useCase, stages, files } = setup({
        detected: {
          [stored(1)]: 'application/pdf',
          [stored(2)]: XLSX,
          [stored(3)]: DOCX,
          [stored(4)]: 'image/apng',
        },
      });

      await useCase.execute({
        actor: staffTax,
        ticketId: 'T-1',
        files: [
          upload(1, 'laporan.pdf'),
          upload(2, 'LPJ.XLSX'),
          upload(3, '../capex.docx'),
          upload(4, 'foto.png'),
        ],
      });

      expect(stages.commands[0].completionFiles).toEqual([
        {
          fileName: 'laporan.pdf',
          storedName: stored(1),
          mimeType: 'application/pdf',
          size: 1001,
        },
        {
          fileName: 'LPJ.XLSX',
          storedName: stored(2),
          mimeType: XLSX,
          size: 1002,
        },
        {
          fileName: 'capex.docx',
          storedName: stored(3),
          mimeType: DOCX,
          size: 1003,
        },
        {
          fileName: 'foto.png',
          storedName: stored(4),
          mimeType: 'image/png',
          size: 1004,
        },
      ]);
      expect(files.removed).toEqual([]);
    });

    it.each([
      ['isi zip biasa berekstensi xlsx', 'application/zip', 'a.xlsx'],
      ['isi xml berekstensi png', 'application/xml', 'a.png'],
      ['tipe tak terdeteksi', null, 'a.pdf'],
      ['ekstensi tidak cocok dengan isi', 'application/pdf', 'a.docx'],
      ['isi xlsx berekstensi docx', XLSX, 'a.docx'],
    ])(
      'menolak %s dan menghapus semua file dari disk',
      async (_label, detected, name) => {
        const { useCase, stages, files } = setup({
          detected: { [stored(1)]: 'application/pdf', [stored(2)]: detected },
        });

        const run = useCase.execute({
          actor: staffTax,
          ticketId: 'T-1',
          files: [upload(1), upload(2, name)],
        });

        await expect(run).rejects.toThrow(
          new BadRequestException(UNSUPPORTED_COMPLETION_FILE_MESSAGE),
        );
        expect(stages.commands).toEqual([]);
        expect(files.removed).toEqual([stored(1), stored(2)]);
      },
    );

    it.each([0, 10 * 1024 * 1024 + 1])(
      'menolak file berukuran %i byte dan menghapus semua file',
      async (size) => {
        const { useCase, stages, files } = setup({
          detected: { [stored(1)]: 'application/pdf' },
        });

        await expect(
          useCase.execute({
            actor: staffTax,
            ticketId: 'T-1',
            files: [{ ...upload(1), size }],
          }),
        ).rejects.toThrow(
          new BadRequestException(COMPLETION_FILE_SIZE_MESSAGE),
        );
        expect(stages.commands).toEqual([]);
        expect(files.removed).toEqual([stored(1)]);
      },
    );

    it('menolak lebih dari 5 file dan menghapus semuanya', async () => {
      const { useCase, stages, files } = setup({});
      const six = [1, 2, 3, 4, 5, 6].map((n) => upload(n));

      await expect(
        useCase.execute({ actor: staffTax, ticketId: 'T-1', files: six }),
      ).rejects.toThrow(new BadRequestException(COMPLETION_FILE_LIMIT_MESSAGE));

      expect(stages.commands).toEqual([]);
      expect(files.removed).toEqual(six.map((file) => file.storedName));
    });

    it('menghapus semua file dan mengembalikan 409 bila tahap sudah berubah', async () => {
      const { useCase, files } = setup({
        advanced: false,
        detected: { [stored(1)]: 'application/pdf' },
      });

      await expect(
        useCase.execute({
          actor: staffTax,
          ticketId: 'T-1',
          files: [upload(1)],
        }),
      ).rejects.toThrow(new ConflictException(STAGE_CHANGED_MESSAGE));

      expect(files.removed).toEqual([stored(1)]);
    });
  });

  describe('otorisasi', () => {
    it.each([
      ['tiket tidak ada', null, staffTax],
      ['staf divisi lain', ticketAt('DIPROSES'), staffLegal],
    ])('404 untuk %s', async (_label, ticket, actor) => {
      const { useCase, stages, files } = setup({ ticket });

      await expect(
        useCase.execute({ actor, ticketId: 'T-1', files: [upload(1)] }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(stages.commands).toEqual([]);
      expect(files.removed).toEqual([stored(1)]);
    });

    it.each([
      ['manajer divisi tujuan', managerTax],
      ['staf divisi asal', staffIt],
      ['superadmin', superadmin],
    ])('403 untuk %s', async (_label, actor) => {
      const { useCase, stages, files } = setup({});

      await expect(
        useCase.execute({ actor, ticketId: 'T-1', files: [upload(1)] }),
      ).rejects.toThrow(new ForbiddenException(NOT_AUTHORIZED_ACTOR_MESSAGE));
      expect(stages.commands).toEqual([]);
      expect(files.removed).toEqual([stored(1)]);
    });

    it('409 bila aksi selesai belum tersedia pada tahap MENUNGGU_STAF_TUJUAN', async () => {
      const { useCase, stages } = setup({
        ticket: ticketAt('MENUNGGU_STAF_TUJUAN'),
      });

      await expect(
        useCase.execute({ actor: staffTax, ticketId: 'T-1', files: [] }),
      ).rejects.toThrow(new ConflictException(ACTION_NOT_AVAILABLE_MESSAGE));
      expect(stages.commands).toEqual([]);
    });

    it.each(['SELESAI', 'DITOLAK'] as const)(
      '403 pada tahap akhir %s',
      async (stage) => {
        const { useCase, stages } = setup({ ticket: ticketAt(stage) });

        await expect(
          useCase.execute({ actor: staffTax, ticketId: 'T-1', files: [] }),
        ).rejects.toThrow(new ForbiddenException(NOT_AUTHORIZED_ACTOR_MESSAGE));
        expect(stages.commands).toEqual([]);
      },
    );
  });

  describe('assertCanComplete', () => {
    it('lolos untuk staf divisi tujuan pada tahap DIPROSES tanpa menulis apa pun', async () => {
      const { useCase, stages } = setup({});

      await expect(
        useCase.assertCanComplete(staffTax, 'T-1'),
      ).resolves.toBeUndefined();
      expect(stages.commands).toEqual([]);
    });

    it('menolak pengguna yang tidak berwenang sebelum file diterima', async () => {
      const { useCase } = setup({});

      await expect(
        useCase.assertCanComplete(managerTax, 'T-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});

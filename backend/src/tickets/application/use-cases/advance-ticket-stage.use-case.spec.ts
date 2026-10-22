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
import { TICKET_NOT_FOUND_MESSAGE } from '../../attachments/application/use-cases/upload-attachment.use-case';
import { StageAction } from '../../domain/ticket-stage-flow';
import { VisibleTicket } from '../../domain/ticket-visibility';
import { TicketQueryRepository } from '../ports/ticket-query.repository';
import { TicketStageRepository } from '../ports/ticket-stage.repository';
import {
  ACTION_NOT_AVAILABLE_MESSAGE,
  AdvanceTicketStageUseCase,
  COMPLETE_VIA_ENDPOINT_MESSAGE,
  NOT_AUTHORIZED_ACTOR_MESSAGE,
  REASON_INVALID_CHARACTER_MESSAGE,
  REASON_LENGTH_MESSAGE,
  REASON_NOT_ALLOWED_MESSAGE,
  STAGE_CHANGED_MESSAGE,
} from './advance-ticket-stage.use-case';

const user = (role: Role, divisi: Divisi | null, id: number): AuthUser => ({
  id,
  fullName: 'Pengguna Uji',
  role,
  divisi,
  isActive: true,
  passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
});

const staffIt = user(Role.TEAM_MAIN_OFFICE, Divisi.IT, 11);
const managerIt = user(Role.MANAGER_MAIN_OFFICE, Divisi.IT, 12);
const managerTax = user(Role.MANAGER_MAIN_OFFICE, Divisi.TAX, 22);
const staffTax = user(Role.TEAM_MAIN_OFFICE, Divisi.TAX, 23);
const staffLegal = user(Role.TEAM_MAIN_OFFICE, Divisi.LEGAL, 31);
const superadmin = user(Role.SUPERADMIN, null, 1);

const REASON = 'Sudah sesuai dengan kebutuhan divisi';

const ticket = (
  stage: TicketStage,
  rejectedAtStage: TicketStage | null = null,
): VisibleTicket => ({
  fromDivisi: Divisi.IT,
  toDivisi: Divisi.TAX,
  stage,
  rejectedAtStage,
});

describe('AdvanceTicketStageUseCase', () => {
  const queries = { findVisibilityById: jest.fn() };
  const stages = { advanceStage: jest.fn() };
  const useCase = new AdvanceTicketStageUseCase(
    queries as unknown as TicketQueryRepository,
    stages as unknown as TicketStageRepository,
  );

  const advance = (
    actor: AuthUser,
    action: StageAction,
    found: VisibleTicket | null,
    reason?: string,
  ) => {
    queries.findVisibilityById.mockResolvedValue(found);
    return useCase.execute({
      actor,
      ticketId: 'IT-20261008-001',
      action,
      reason,
    });
  };

  beforeEach(() => {
    jest.resetAllMocks();
    stages.advanceStage.mockResolvedValue(true);
  });

  describe('alur yang sah', () => {
    it.each([
      [
        'manager asal menerima',
        managerIt,
        'TERIMA',
        'MENUNGGU_MANAGER_ASAL',
        'MENUNGGU_MANAGER_TUJUAN',
      ],
      [
        'manager asal menolak',
        managerIt,
        'TOLAK',
        'MENUNGGU_MANAGER_ASAL',
        'DITOLAK',
      ],
      [
        'manager tujuan menerima',
        managerTax,
        'TERIMA',
        'MENUNGGU_MANAGER_TUJUAN',
        'MENUNGGU_STAF_TUJUAN',
      ],
      [
        'manager tujuan menolak',
        managerTax,
        'TOLAK',
        'MENUNGGU_MANAGER_TUJUAN',
        'DITOLAK',
      ],
      [
        'staf tujuan memproses',
        staffTax,
        'PROSES',
        'MENUNGGU_STAF_TUJUAN',
        'DIPROSES',
      ],
    ] as [string, AuthUser, StageAction, TicketStage, TicketStage][])(
      '%s',
      async (_label, actor, action, from, to) => {
        const reason = action === 'PROSES' ? undefined : REASON;

        await expect(
          advance(actor, action, ticket(from), reason),
        ).resolves.toEqual({
          id: 'IT-20261008-001',
          stage: to,
        });

        expect(stages.advanceStage).toHaveBeenCalledWith({
          ticketId: 'IT-20261008-001',
          expectedStage: from,
          action,
          nextStage: to,
          actorId: actor.id,
          reason: reason ?? null,
        });
      },
    );

    it('memakai tahap dari database dan ID pelaku dari sesi', async () => {
      await advance(staffTax, 'PROSES', ticket('MENUNGGU_STAF_TUJUAN'));

      const [command] = stages.advanceStage.mock.calls[0];
      expect(command.expectedStage).toBe('MENUNGGU_STAF_TUJUAN');
      expect(command.actorId).toBe(23);
    });
  });

  describe('urutan penolakan', () => {
    it('menjawab 404 kalau tiket tidak ada', async () => {
      await expect(advance(managerIt, 'TERIMA', null)).rejects.toThrow(
        new NotFoundException(TICKET_NOT_FOUND_MESSAGE),
      );
      expect(stages.advanceStage).not.toHaveBeenCalled();
    });

    it('menjawab 404, bukan 403, kalau tiket tidak boleh dilihat pelaku', async () => {
      await expect(
        advance(staffLegal, 'TERIMA', ticket('MENUNGGU_MANAGER_ASAL')),
      ).rejects.toThrow(new NotFoundException(TICKET_NOT_FOUND_MESSAGE));
      await expect(
        advance(managerTax, 'TERIMA', ticket('MENUNGGU_MANAGER_ASAL')),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        advance(staffTax, 'PROSES', ticket('MENUNGGU_MANAGER_TUJUAN')),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(stages.advanceStage).not.toHaveBeenCalled();
    });

    it.each([
      [
        'staf asal mencoba menerima',
        staffIt,
        'TERIMA',
        'MENUNGGU_MANAGER_ASAL',
      ],
      [
        'manager asal mencoba menerima di tahap tujuan',
        managerIt,
        'TERIMA',
        'MENUNGGU_MANAGER_TUJUAN',
      ],
      [
        'manager tujuan mencoba memproses',
        managerTax,
        'PROSES',
        'MENUNGGU_STAF_TUJUAN',
      ],
      [
        'manager tujuan mencoba menyelesaikan',
        managerTax,
        'SELESAI',
        'DIPROSES',
      ],
      [
        'staf asal mencoba memproses',
        staffIt,
        'PROSES',
        'MENUNGGU_STAF_TUJUAN',
      ],
      [
        'superadmin tidak pernah menjadi pelaku',
        superadmin,
        'TERIMA',
        'MENUNGGU_MANAGER_ASAL',
      ],
    ] as [string, AuthUser, StageAction, TicketStage][])(
      'menjawab 403 untuk %s',
      async (_label, actor, action, stage) => {
        await expect(advance(actor, action, ticket(stage))).rejects.toThrow(
          new ForbiddenException(NOT_AUTHORIZED_ACTOR_MESSAGE),
        );
        expect(stages.advanceStage).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['staf tujuan memproses dua kali', staffTax, 'PROSES', 'DIPROSES'],
      [
        'staf tujuan menyelesaikan sebelum diproses',
        staffTax,
        'SELESAI',
        'MENUNGGU_STAF_TUJUAN',
      ],
      [
        'manager menerima dengan aksi staf',
        managerIt,
        'PROSES',
        'MENUNGGU_MANAGER_ASAL',
      ],
      [
        'manager tujuan menerima dengan aksi staf',
        managerTax,
        'SELESAI',
        'MENUNGGU_MANAGER_TUJUAN',
      ],
    ] as [string, AuthUser, StageAction, TicketStage][])(
      'menjawab 409 untuk %s',
      async (_label, actor, action, stage) => {
        await expect(advance(actor, action, ticket(stage))).rejects.toThrow(
          new ConflictException(ACTION_NOT_AVAILABLE_MESSAGE),
        );
        expect(stages.advanceStage).not.toHaveBeenCalled();
      },
    );

    it.each(['SELESAI', 'DITOLAK'] as TicketStage[])(
      'tidak pernah mengizinkan aksi pada tahap akhir %s',
      async (stage) => {
        const finished = ticket(
          stage,
          stage === 'DITOLAK' ? 'MENUNGGU_MANAGER_TUJUAN' : null,
        );

        await expect(
          advance(staffTax, 'SELESAI', finished),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(stages.advanceStage).not.toHaveBeenCalled();
      },
    );
  });

  describe('alasan', () => {
    const accept = (reason?: string) =>
      advance(managerIt, 'TERIMA', ticket('MENUNGGU_MANAGER_ASAL'), reason);
    const decline = (reason?: string) =>
      advance(managerTax, 'TOLAK', ticket('MENUNGGU_MANAGER_TUJUAN'), reason);

    it.each([
      ['terima', accept],
      ['tolak', decline],
    ])('menjawab 400 kalau alasan %s kosong', async (_label, act) => {
      await expect(act()).rejects.toThrow(
        new BadRequestException(REASON_LENGTH_MESSAGE),
      );
      await expect(act('')).rejects.toThrow(
        new BadRequestException(REASON_LENGTH_MESSAGE),
      );
      await expect(act('   \n\t  ')).rejects.toThrow(
        new BadRequestException(REASON_LENGTH_MESSAGE),
      );
      expect(stages.advanceStage).not.toHaveBeenCalled();
    });

    it('menolak alasan 9 karakter dan menerima 10 karakter setelah trim', async () => {
      await expect(accept('  123456789  ')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(accept('  1234567890  ')).resolves.toBeDefined();
      expect(stages.advanceStage.mock.calls[0][0].reason).toBe('1234567890');
    });

    it('menolak alasan 501 karakter dan menerima 500 karakter', async () => {
      await expect(accept('a'.repeat(501))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(accept('a'.repeat(500))).resolves.toBeDefined();
    });

    it('menyeragamkan baris baru sebelum disimpan', async () => {
      await accept('baris satu\r\nbaris dua');

      expect(stages.advanceStage.mock.calls[0][0].reason).toBe(
        'baris satu\nbaris dua',
      );
    });

    it.each([
      ['karakter kontrol', 'alasan\u0007 valid sekali'],
      ['pengarah teks unicode', 'alasan\u202Evalid sekali'],
      ['lebar nol', 'alasan\u200Bvalid sekali'],
      ['surrogate tunggal', 'alasan valid \uD800 sekali'],
    ])('menolak alasan berisi %s', async (_label, reason) => {
      await expect(accept(reason)).rejects.toThrow(
        new BadRequestException(REASON_INVALID_CHARACTER_MESSAGE),
      );
      expect(stages.advanceStage).not.toHaveBeenCalled();
    });

    it('menolak alasan pada aksi PROSES', async () => {
      await expect(
        advance(staffTax, 'PROSES', ticket('MENUNGGU_STAF_TUJUAN'), REASON),
      ).rejects.toThrow(new BadRequestException(REASON_NOT_ALLOWED_MESSAGE));
      expect(stages.advanceStage).not.toHaveBeenCalled();
    });

    it('memeriksa wewenang sebelum alasan', async () => {
      await expect(
        advance(staffIt, 'TERIMA', ticket('MENUNGGU_MANAGER_ASAL')),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('aksi selesai', () => {
    it('ditolak di jalur PATCH dengan petunjuk endpoint selesai', async () => {
      await expect(
        advance(staffTax, 'SELESAI', ticket('DIPROSES')),
      ).rejects.toThrow(new BadRequestException(COMPLETE_VIA_ENDPOINT_MESSAGE));
      expect(stages.advanceStage).not.toHaveBeenCalled();
    });

    it('tetap menjawab 403 untuk pelaku yang tidak berwenang', async () => {
      await expect(
        advance(managerTax, 'SELESAI', ticket('DIPROSES')),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('persaingan antar permintaan', () => {
    it('menjawab 409 kalau tahap berubah sebelum penulisan', async () => {
      stages.advanceStage.mockResolvedValue(false);

      await expect(
        advance(staffTax, 'PROSES', ticket('MENUNGGU_STAF_TUJUAN')),
      ).rejects.toThrow(new ConflictException(STAGE_CHANGED_MESSAGE));
    });

    it('hanya satu dari dua klik bersamaan yang berhasil', async () => {
      stages.advanceStage
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      queries.findVisibilityById.mockResolvedValue(
        ticket('MENUNGGU_STAF_TUJUAN'),
      );
      const click = () =>
        useCase.execute({
          actor: staffTax,
          ticketId: 'IT-20261008-001',
          action: 'PROSES',
        });

      const results = await Promise.allSettled([click(), click()]);

      expect(results.map((r) => r.status).sort()).toEqual([
        'fulfilled',
        'rejected',
      ]);
    });

    it('meneruskan error repository yang tidak terduga', async () => {
      const failure = new Error('koneksi putus');
      stages.advanceStage.mockRejectedValue(failure);

      await expect(
        advance(staffTax, 'PROSES', ticket('MENUNGGU_STAF_TUJUAN')),
      ).rejects.toBe(failure);
    });
  });
});

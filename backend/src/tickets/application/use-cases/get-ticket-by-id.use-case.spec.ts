import { NotFoundException } from '@nestjs/common';
import { AuthUser } from '../../../auth/domain/auth-user';
import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';
import { TicketStage } from '../../../generated/prisma/client';
import { TICKET_NOT_FOUND_MESSAGE } from '../../attachments/application/use-cases/upload-attachment.use-case';
import {
  TicketDetail,
  TicketQueryRepository,
} from '../ports/ticket-query.repository';
import { GetTicketByIdUseCase } from './get-ticket-by-id.use-case';

const user = (role: Role, divisi: Divisi | null, id = 21): AuthUser => ({
  id,
  fullName: 'Pengguna Uji',
  role,
  divisi,
  isActive: true,
  passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
});

const creator = user(Role.TEAM_MAIN_OFFICE, Divisi.IT, 11);
const managerIt = user(Role.MANAGER_MAIN_OFFICE, Divisi.IT, 12);
const managerTax = user(Role.MANAGER_MAIN_OFFICE, Divisi.TAX, 22);
const staffTax = user(Role.TEAM_MAIN_OFFICE, Divisi.TAX, 23);
const staffLegal = user(Role.TEAM_MAIN_OFFICE, Divisi.LEGAL, 31);
const superadmin = user(Role.SUPERADMIN, null, 1);

const createdAt = new Date('2026-10-08T01:00:00Z');

const attachment = (n: number) => ({
  id: `att-${n}`,
  fileName: `foto-${n}.png`,
  mimeType: 'image/png',
  size: 1000 + n,
});

const detail = (overrides: Partial<TicketDetail> = {}): TicketDetail => ({
  id: 'IT-20261008-001',
  description: 'Printer lantai 2 tidak bisa mencetak',
  stage: 'MENUNGGU_MANAGER_ASAL',
  rejectedAtStage: null,
  fromDivisi: Divisi.IT,
  toDivisi: Divisi.TAX,
  createdAt,
  createdById: 11,
  createdBy: { fullName: 'Ayu Lestari', divisi: Divisi.IT },
  attachments: [],
  timeline: [
    {
      action: 'DIBUAT',
      fromStage: null,
      toStage: 'MENUNGGU_MANAGER_ASAL',
      createdAt,
      actor: { fullName: 'Ayu Lestari', divisi: Divisi.IT },
    },
  ],
  ...overrides,
});

describe('GetTicketByIdUseCase', () => {
  const tickets = { findDetailById: jest.fn() };
  const useCase = new GetTicketByIdUseCase(
    tickets as unknown as TicketQueryRepository,
  );

  const get = (actor: AuthUser, found: TicketDetail | null) => {
    tickets.findDetailById.mockResolvedValue(found);
    return useCase.execute({ user: actor, ticketId: 'IT-20261008-001' });
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('visibilitas', () => {
    it('menjawab 404 kalau tiket tidak ada', async () => {
      await expect(get(creator, null)).rejects.toThrow(
        new NotFoundException(TICKET_NOT_FOUND_MESSAGE),
      );
    });

    it('menjawab 404 yang identik untuk tiket yang tidak boleh dilihat', async () => {
      const missing = await get(creator, null).catch((e: unknown) => e);
      const hidden = await get(staffLegal, detail()).catch((e: unknown) => e);

      expect(hidden).toBeInstanceOf(NotFoundException);
      expect((hidden as NotFoundException).getResponse()).toEqual(
        (missing as NotFoundException).getResponse(),
      );
    });

    it('tidak membocorkan ID dari URL di pesan error', async () => {
      tickets.findDetailById.mockResolvedValue(null);

      const error = await useCase
        .execute({ user: staffLegal, ticketId: 'IT-1 hubungi evil.example' })
        .catch((e: unknown) => e as NotFoundException);

      expect(
        JSON.stringify((error as NotFoundException).getResponse()),
      ).not.toContain('evil.example');
    });

    it.each([
      [
        'staf tujuan sebelum manager asal menyetujui',
        staffTax,
        'MENUNGGU_MANAGER_ASAL',
      ],
      [
        'manager tujuan sebelum manager asal menyetujui',
        managerTax,
        'MENUNGGU_MANAGER_ASAL',
      ],
      [
        'staf tujuan saat menunggu manager tujuan',
        staffTax,
        'MENUNGGU_MANAGER_TUJUAN',
      ],
    ] as [string, AuthUser, TicketStage][])(
      'menjawab 404 untuk %s',
      async (_label, actor, stage) => {
        await expect(get(actor, detail({ stage }))).rejects.toBeInstanceOf(
          NotFoundException,
        );
      },
    );

    it('menyembunyikan penolakan manager asal dari divisi tujuan', async () => {
      const rejected = detail({
        stage: 'DITOLAK',
        rejectedAtStage: 'MENUNGGU_MANAGER_ASAL',
      });

      await expect(get(managerTax, rejected)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(get(managerIt, rejected)).resolves.toBeDefined();
    });

    it('mengizinkan manager tujuan saat menunggu persetujuannya', async () => {
      await expect(
        get(managerTax, detail({ stage: 'MENUNGGU_MANAGER_TUJUAN' })),
      ).resolves.toBeDefined();
    });

    it('mengizinkan superadmin melihat tetapi tanpa aksi', async () => {
      const view = await get(superadmin, detail());

      expect(view.availableActions).toEqual([]);
      expect(view.isCreator).toBe(false);
      expect(view.canUploadAttachment).toBe(false);
    });
  });

  describe('isi tampilan', () => {
    it('hanya memuat kolom yang sudah dipetakan, tanpa id pengguna', async () => {
      const view = await get(
        creator,
        detail({
          attachments: [attachment(1)],
          createdBy: {
            fullName: 'Ayu Lestari',
            divisi: Divisi.IT,
            id: 11,
            password: 'rahasia',
          } as TicketDetail['createdBy'],
        }),
      );

      const serialized = JSON.stringify(view);
      expect(serialized).not.toContain('rahasia');
      expect(serialized).not.toContain('createdById');
      expect(view.createdBy).toEqual({
        fullName: 'Ayu Lestari',
        divisi: Divisi.IT,
      });
      expect(view.attachments).toEqual([attachment(1)]);
      expect(view.timeline[0]).toEqual({
        action: 'DIBUAT',
        fromStage: null,
        toStage: 'MENUNGGU_MANAGER_ASAL',
        createdAt,
        actor: { fullName: 'Ayu Lestari', divisi: Divisi.IT },
      });
    });

    it('menyertakan deskripsi lengkap dan tahap penolakan', async () => {
      const view = await get(
        managerIt,
        detail({
          stage: 'DITOLAK',
          rejectedAtStage: 'MENUNGGU_MANAGER_TUJUAN',
        }),
      );

      expect(view.description).toBe('Printer lantai 2 tidak bisa mencetak');
      expect(view.rejectedAtStage).toBe('MENUNGGU_MANAGER_TUJUAN');
    });
  });

  describe('availableActions', () => {
    it.each([
      [
        'manager asal pada tahap pertama',
        managerIt,
        'MENUNGGU_MANAGER_ASAL',
        ['TERIMA', 'TOLAK'],
      ],
      [
        'manager tujuan pada tahap kedua',
        managerTax,
        'MENUNGGU_MANAGER_TUJUAN',
        ['TERIMA', 'TOLAK'],
      ],
      [
        'staf tujuan pada tahap diterima',
        staffTax,
        'MENUNGGU_STAF_TUJUAN',
        ['PROSES'],
      ],
      ['staf tujuan saat diproses', staffTax, 'DIPROSES', ['SELESAI']],
      ['staf asal tidak punya aksi', creator, 'MENUNGGU_MANAGER_ASAL', []],
      [
        'manager tujuan tidak bisa memproses',
        managerTax,
        'MENUNGGU_STAF_TUJUAN',
        [],
      ],
      ['staf tujuan pada tahap selesai', staffTax, 'SELESAI', []],
      ['manager asal pada tahap ditolak', managerIt, 'DITOLAK', []],
    ] as [string, AuthUser, TicketStage, string[]][])(
      '%s',
      async (_label, actor, stage, expected) => {
        const view = await get(
          actor,
          detail({
            stage,
            rejectedAtStage:
              stage === 'DITOLAK' ? 'MENUNGGU_MANAGER_TUJUAN' : null,
          }),
        );

        expect(view.availableActions).toEqual(expected);
      },
    );
  });

  describe('canUploadAttachment', () => {
    it('mengizinkan pembuat saat masih menunggu manager asal dan di bawah batas', async () => {
      const view = await get(
        creator,
        detail({ attachments: [1, 2, 3, 4].map(attachment) }),
      );

      expect(view.isCreator).toBe(true);
      expect(view.canUploadAttachment).toBe(true);
    });

    it('menolak kalau lampiran sudah mencapai batas', async () => {
      const view = await get(
        creator,
        detail({ attachments: [1, 2, 3, 4, 5].map(attachment) }),
      );

      expect(view.canUploadAttachment).toBe(false);
    });

    it('menolak kalau tahap sudah lewat manager asal', async () => {
      const view = await get(
        creator,
        detail({ stage: 'MENUNGGU_MANAGER_TUJUAN' }),
      );

      expect(view.canUploadAttachment).toBe(false);
    });

    it('menolak pengguna lain di divisi asal yang bukan pembuat', async () => {
      const view = await get(managerIt, detail());

      expect(view.isCreator).toBe(false);
      expect(view.canUploadAttachment).toBe(false);
    });
  });
});

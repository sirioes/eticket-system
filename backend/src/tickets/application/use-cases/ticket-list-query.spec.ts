import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Divisi } from '../../../common/enums/divisi.enum';
import {
  INVALID_DATE_MESSAGE,
  INVALID_DATE_RANGE_MESSAGE,
  requireDivisi,
  toTicketListFilter,
  toTicketListView,
  USER_WITHOUT_DIVISI_MESSAGE,
} from './ticket-list-query';

describe('requireDivisi', () => {
  it('mengembalikan divisi pengguna', () => {
    expect(requireDivisi({ divisi: Divisi.TAX })).toBe(Divisi.TAX);
  });

  it('menolak pengguna tanpa divisi dengan 403', () => {
    expect(() => requireDivisi({ divisi: null })).toThrow(
      new ForbiddenException(USER_WITHOUT_DIVISI_MESSAGE),
    );
  });
});

describe('toTicketListFilter', () => {
  it('menghasilkan filter kosong kalau tidak ada parameter', () => {
    expect(toTicketListFilter({})).toEqual({});
  });

  it('memetakan nama parameter ke nama filter repository', () => {
    expect(
      toTicketListFilter({
        search: 'IT-2026',
        status: 'DIPROSES',
        divisi: Divisi.FINANCE,
      }),
    ).toEqual({
      search: 'IT-2026',
      stage: 'DIPROSES',
      counterpartDivisi: Divisi.FINANCE,
    });
  });

  it('menafsirkan tanggal sebagai hari WITA dengan batas akhir eksklusif', () => {
    expect(
      toTicketListFilter({ dateFrom: '2026-10-08', dateTo: '2026-10-09' }),
    ).toEqual({
      createdFrom: new Date('2026-10-07T16:00:00.000Z'),
      createdBefore: new Date('2026-10-09T16:00:00.000Z'),
    });
  });

  it('menerima rentang satu hari (tanggal awal sama dengan tanggal akhir)', () => {
    expect(
      toTicketListFilter({ dateFrom: '2026-10-08', dateTo: '2026-10-08' }),
    ).toEqual({
      createdFrom: new Date('2026-10-07T16:00:00.000Z'),
      createdBefore: new Date('2026-10-08T16:00:00.000Z'),
    });
  });

  it('menerima salah satu sisi tanggal saja', () => {
    expect(toTicketListFilter({ dateFrom: '2026-10-08' })).toEqual({
      createdFrom: new Date('2026-10-07T16:00:00.000Z'),
    });
    expect(toTicketListFilter({ dateTo: '2026-10-08' })).toEqual({
      createdBefore: new Date('2026-10-08T16:00:00.000Z'),
    });
  });

  it('menolak tanggal awal setelah tanggal akhir', () => {
    expect(() =>
      toTicketListFilter({ dateFrom: '2026-10-09', dateTo: '2026-10-08' }),
    ).toThrow(new BadRequestException(INVALID_DATE_RANGE_MESSAGE));
  });

  it.each(['dateFrom', 'dateTo'] as const)(
    'menolak tanggal tidak valid di %s',
    (field) => {
      expect(() => toTicketListFilter({ [field]: '2026-02-30' })).toThrow(
        new BadRequestException(INVALID_DATE_MESSAGE),
      );
    },
  );
});

describe('toTicketListView', () => {
  const createdAt = new Date('2026-10-08T01:00:00Z');

  const item = (description: string) => ({
    id: 'IT-20261008-001',
    description,
    stage: 'DIPROSES' as const,
    fromDivisi: Divisi.IT,
    toDivisi: Divisi.TAX,
    createdAt,
    attachmentCount: 2,
  });

  it('memetakan baris, memotong deskripsi, dan menghitung total halaman', () => {
    const view = toTicketListView(
      { items: [item('x'.repeat(300))], total: 21 },
      { page: 2, limit: 10 },
    );

    expect(view).toEqual({
      items: [
        {
          id: 'IT-20261008-001',
          descriptionPreview: `${'x'.repeat(120)}…`,
          stage: 'DIPROSES',
          fromDivisi: Divisi.IT,
          toDivisi: Divisi.TAX,
          createdAt,
          attachmentCount: 2,
        },
      ],
      total: 21,
      page: 2,
      limit: 10,
      totalPages: 3,
    });
  });

  it('tidak membawa deskripsi lengkap ke dalam daftar', () => {
    const view = toTicketListView(
      { items: [item('Printer rusak')], total: 1 },
      { page: 1, limit: 10 },
    );

    expect(view.items[0]).not.toHaveProperty('description');
  });

  it('memberi 0 halaman kalau tidak ada data', () => {
    expect(
      toTicketListView({ items: [], total: 0 }, { page: 1, limit: 10 })
        .totalPages,
    ).toBe(0);
  });

  it('membulatkan ke atas pada kelipatan tepat dan tidak tepat', () => {
    const totalPages = (total: number) =>
      toTicketListView({ items: [], total }, { page: 1, limit: 10 }).totalPages;

    expect(totalPages(10)).toBe(1);
    expect(totalPages(11)).toBe(2);
  });
});

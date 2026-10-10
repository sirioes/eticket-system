import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { VALIDATION_PIPE_OPTIONS } from '../../../app.setup';
import { Divisi } from '../../../common/enums/divisi.enum';
import { ListTicketsQueryDto } from './list-tickets-query.dto';
import { TicketFilterQueryDto } from './ticket-filter-query.dto';

const pipe = new ValidationPipe(VALIDATION_PIPE_OPTIONS);

const parse = <T>(
  metatype: new () => T,
  query: Record<string, unknown>,
): Promise<T> =>
  pipe.transform(query, {
    type: 'query',
    metatype,
  } as ArgumentMetadata) as Promise<T>;

const parseList = (query: Record<string, unknown>) =>
  parse(ListTicketsQueryDto, query);

const messagesOf = async (promise: Promise<unknown>): Promise<string[]> => {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(BadRequestException);
  const { message } = (error as BadRequestException).getResponse() as {
    message: string | string[];
  };
  return [message].flat();
};

describe('ListTicketsQueryDto', () => {
  it('memakai halaman 1 dan 10 baris kalau tidak ada parameter', async () => {
    const query = await parseList({});

    expect(query.page).toBe(1);
    expect(query.limit).toBe(10);
    expect(query.search).toBeUndefined();
    expect(query.status).toBeUndefined();
    expect(query.divisi).toBeUndefined();
    expect(query.dateFrom).toBeUndefined();
    expect(query.dateTo).toBeUndefined();
  });

  it('mengubah page dan limit dari string menjadi angka', async () => {
    const query = await parseList({ page: '3', limit: '25' });

    expect(query.page).toBe(3);
    expect(query.limit).toBe(25);
  });

  it.each([
    ['page', '0'],
    ['page', '-1'],
    ['page', '1.5'],
    ['page', 'abc'],
    ['page', '1001'],
    ['page', ''],
    ['limit', '0'],
    ['limit', '101'],
    ['limit', '-5'],
    ['limit', '10.5'],
    ['limit', 'banyak'],
  ])('menolak %s bernilai "%s"', async (field, value) => {
    await expect(parseList({ [field]: value })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('menerima batas atas page dan limit', async () => {
    const query = await parseList({ page: '1000', limit: '100' });

    expect(query.page).toBe(1000);
    expect(query.limit).toBe(100);
  });

  it('menolak parameter di luar daftar yang diizinkan', async () => {
    const messages = await messagesOf(parseList({ sort: 'createdAt' }));

    expect(messages).toEqual(['property sort should not exist']);
  });

  it('menolak parameter ganda yang menjadi array', async () => {
    await expect(parseList({ page: ['1', '2'] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      parseList({ search: ['IT-1', 'IT-2'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('TicketFilterQueryDto', () => {
  const parseFilter = (query: Record<string, unknown>) =>
    parse(TicketFilterQueryDto, query);

  describe('search', () => {
    it.each(['IT-20261008-001', 'it-2026', '001', 'A'])(
      'menerima "%s"',
      async (search) => {
        await expect(parseFilter({ search })).resolves.toMatchObject({
          search,
        });
      },
    );

    it('memangkas spasi di tepi', async () => {
      await expect(
        parseFilter({ search: '  IT-2026  ' }),
      ).resolves.toMatchObject({ search: 'IT-2026' });
    });

    it.each(['', '   '])(
      'menganggap "%s" sebagai tidak ada filter',
      async (search) => {
        const query = await parseFilter({ search });

        expect(query.search).toBeUndefined();
      },
    );

    it.each([
      '%',
      '_',
      'IT_2026',
      'IT%',
      "' OR 1=1 --",
      'IT 2026',
      'IT/2026',
      '<script>',
      'IT-20\n26',
      'ＩＴ-2026',
    ])('menolak "%s"', async (search) => {
      await expect(parseFilter({ search })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('menerima 100 karakter dan menolak 101', async () => {
      await expect(
        parseFilter({ search: 'A'.repeat(100) }),
      ).resolves.toBeDefined();
      await expect(
        parseFilter({ search: 'A'.repeat(101) }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('status', () => {
    it.each([
      'MENUNGGU_MANAGER_ASAL',
      'MENUNGGU_MANAGER_TUJUAN',
      'MENUNGGU_STAF_TUJUAN',
      'DIPROSES',
      'SELESAI',
      'DITOLAK',
    ])('menerima %s', async (status) => {
      await expect(parseFilter({ status })).resolves.toMatchObject({ status });
    });

    it.each(['diproses', 'DIBUAT', 'BATAL', '1'])(
      'menolak %s',
      async (status) => {
        await expect(parseFilter({ status })).rejects.toBeInstanceOf(
          BadRequestException,
        );
      },
    );

    it('menganggap string kosong sebagai tidak ada filter', async () => {
      const query = await parseFilter({ status: '' });

      expect(query.status).toBeUndefined();
    });
  });

  describe('divisi', () => {
    it.each(Object.values(Divisi))('menerima %s', async (divisi) => {
      await expect(parseFilter({ divisi })).resolves.toMatchObject({ divisi });
    });

    it.each(['it', 'Finance', 'HRD', 'IT,TAX'])(
      'menolak %s',
      async (divisi) => {
        await expect(parseFilter({ divisi })).rejects.toBeInstanceOf(
          BadRequestException,
        );
      },
    );
  });

  describe('dateFrom dan dateTo', () => {
    it.each(['dateFrom', 'dateTo'])(
      'menerima tanggal valid di %s',
      async (field) => {
        await expect(
          parseFilter({ [field]: '2026-10-08' }),
        ).resolves.toMatchObject({ [field]: '2026-10-08' });
      },
    );

    it('menerima 29 Februari di tahun kabisat', async () => {
      await expect(
        parseFilter({ dateFrom: '2028-02-29' }),
      ).resolves.toBeDefined();
    });

    it.each([
      '2026-02-30',
      '2026-02-29',
      '2026-13-01',
      '2026-00-10',
      '2026-10-32',
      '08-10-2026',
      '2026-1-8',
      '20261008',
      '2026-10-08T00:00:00Z',
      '2026-10-08 00:00',
      'kemarin',
    ])('menolak "%s"', async (value) => {
      await expect(parseFilter({ dateFrom: value })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(parseFilter({ dateTo: value })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('menganggap string kosong sebagai tidak ada filter', async () => {
      const query = await parseFilter({ dateFrom: '', dateTo: ' ' });

      expect(query.dateFrom).toBeUndefined();
      expect(query.dateTo).toBeUndefined();
    });
  });

  it('menolak page dan limit karena export tidak mengenal paginasi', async () => {
    await expect(parseFilter({ page: '1' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(parseFilter({ limit: '10' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

import { Divisi } from '../../common/enums/divisi.enum';
import { Role } from '../../common/enums/role.enum';
import { TicketStage } from '../../generated/prisma/client';
import { canViewTicket } from '../domain/ticket-visibility';
import { buildIncomingWhere, buildOutgoingWhere } from './ticket-list-where';

interface Row {
  readonly toDivisi: Divisi;
  readonly stage: TicketStage;
  readonly rejectedAtStage: TicketStage | null;
}

interface Clause {
  readonly AND?: Clause[];
  readonly OR?: Clause[];
  readonly toDivisi?: Divisi;
  readonly stage?: unknown;
  readonly rejectedAtStage?: unknown;
}

const matchesValue = (condition: unknown, value: unknown): boolean => {
  if (
    condition !== null &&
    typeof condition === 'object' &&
    'in' in condition
  ) {
    return (condition.in as unknown[]).includes(value);
  }
  return condition === value;
};

const matches = (clause: Clause, row: Row): boolean =>
  (clause.AND === undefined || clause.AND.every((c) => matches(c, row))) &&
  (clause.OR === undefined || clause.OR.some((c) => matches(c, row))) &&
  (clause.toDivisi === undefined || clause.toDivisi === row.toDivisi) &&
  (clause.stage === undefined || matchesValue(clause.stage, row.stage)) &&
  (clause.rejectedAtStage === undefined ||
    matchesValue(clause.rejectedAtStage, row.rejectedAtStage));

const staff = { role: Role.TEAM_MAIN_OFFICE, divisi: Divisi.TAX };
const manager = { role: Role.MANAGER_MAIN_OFFICE, divisi: Divisi.TAX };

describe('buildOutgoingWhere', () => {
  const scope = { fromDivisi: Divisi.IT };

  it('hanya membatasi divisi asal kalau tidak ada filter', () => {
    expect(buildOutgoingWhere(scope, {})).toEqual({
      AND: [{ fromDivisi: Divisi.IT }],
    });
  });

  it('memetakan filter divisi ke divisi tujuan', () => {
    expect(
      buildOutgoingWhere(scope, { counterpartDivisi: Divisi.FINANCE }),
    ).toEqual({
      AND: [{ fromDivisi: Divisi.IT }, { toDivisi: Divisi.FINANCE }],
    });
  });

  it('menerapkan pencarian ID, status, dan rentang tanggal sekaligus', () => {
    const createdFrom = new Date('2026-09-30T16:00:00Z');
    const createdBefore = new Date('2026-10-07T16:00:00Z');

    expect(
      buildOutgoingWhere(scope, {
        search: 'IT-2026',
        stage: 'DIPROSES',
        createdFrom,
        createdBefore,
      }),
    ).toEqual({
      AND: [
        { fromDivisi: Divisi.IT },
        { id: { contains: 'IT-2026' } },
        { stage: 'DIPROSES' },
        { createdAt: { gte: createdFrom, lt: createdBefore } },
      ],
    });
  });

  it('mendukung rentang tanggal dengan satu sisi saja', () => {
    const createdFrom = new Date('2026-09-30T16:00:00Z');
    const createdBefore = new Date('2026-10-07T16:00:00Z');

    expect(buildOutgoingWhere(scope, { createdFrom }).AND).toContainEqual({
      createdAt: { gte: createdFrom },
    });
    expect(buildOutgoingWhere(scope, { createdBefore }).AND).toContainEqual({
      createdAt: { lt: createdBefore },
    });
  });

  it('tidak membiarkan filter menimpa batas divisi asal', () => {
    const where = buildOutgoingWhere(scope, {
      counterpartDivisi: Divisi.IT,
    });

    expect(where.AND).toContainEqual({ fromDivisi: Divisi.IT });
  });
});

describe('buildIncomingWhere', () => {
  it('menyaring staf ke tahap yang boleh dilihat', () => {
    expect(buildIncomingWhere({ viewer: staff }, {})).toEqual({
      AND: [
        { toDivisi: Divisi.TAX },
        {
          OR: [
            {
              stage: {
                in: ['MENUNGGU_STAF_TUJUAN', 'DIPROSES', 'SELESAI'],
              },
            },
            {
              stage: 'DITOLAK',
              OR: [
                { rejectedAtStage: { in: ['MENUNGGU_MANAGER_TUJUAN'] } },
                { rejectedAtStage: null },
              ],
            },
          ],
        },
      ],
    });
  });

  it('menambahkan tahap menunggu manager tujuan untuk manager', () => {
    const where = buildIncomingWhere({ viewer: manager }, {});

    expect(where.AND).toContainEqual({
      OR: [
        {
          stage: {
            in: [
              'MENUNGGU_MANAGER_TUJUAN',
              'MENUNGGU_STAF_TUJUAN',
              'DIPROSES',
              'SELESAI',
            ],
          },
        },
        expect.objectContaining({ stage: 'DITOLAK' }),
      ],
    });
  });

  it('memetakan filter divisi ke divisi asal', () => {
    expect(
      buildIncomingWhere({ viewer: staff }, { counterpartDivisi: Divisi.LEGAL })
        .AND,
    ).toContainEqual({ fromDivisi: Divisi.LEGAL });
  });

  it('menaruh filter pengguna di luar aturan visibilitas, bukan menggantikannya', () => {
    const where = buildIncomingWhere(
      { viewer: staff },
      { stage: 'MENUNGGU_MANAGER_ASAL' },
    );

    expect(
      matches(where as Clause, {
        toDivisi: Divisi.TAX,
        stage: 'MENUNGGU_MANAGER_ASAL',
        rejectedAtStage: null,
      }),
    ).toBe(false);
  });

  describe.each([
    ['staf', Role.TEAM_MAIN_OFFICE],
    ['manager', Role.MANAGER_MAIN_OFFICE],
    ['staf finance', Role.FINANCE_MAIN_OFFICE],
    ['manager finance', Role.FINANCE_MANAGER_MAIN_OFFICE],
  ])('konsisten dengan canViewTicket untuk %s', (_label, role) => {
    const rows: Row[] = [];
    for (const stage of Object.values(TicketStage)) {
      const origins: (TicketStage | null)[] =
        stage === 'DITOLAK'
          ? [null, 'MENUNGGU_MANAGER_ASAL', 'MENUNGGU_MANAGER_TUJUAN']
          : [null];
      for (const rejectedAtStage of origins) {
        rows.push({ toDivisi: Divisi.TAX, stage, rejectedAtStage });
      }
    }

    it.each(rows)('stage $stage, ditolak di $rejectedAtStage', (row) => {
      const where = buildIncomingWhere(
        { viewer: { role, divisi: Divisi.TAX } },
        {},
      );

      expect(matches(where as Clause, row)).toBe(
        canViewTicket(
          { role, divisi: Divisi.TAX },
          { fromDivisi: Divisi.IT, ...row },
        ),
      );
    });
  });
});
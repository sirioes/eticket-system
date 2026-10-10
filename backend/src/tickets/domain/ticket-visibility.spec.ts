import { TicketStage } from '../../generated/prisma/client';
import { Divisi } from '../../common/enums/divisi.enum';
import { Role } from '../../common/enums/role.enum';
import {
  canViewAsDestination,
  canViewTicket,
  VisibleTicket,
} from './ticket-visibility';

const ticket = (
  stage: TicketStage,
  rejectedAtStage: TicketStage | null = null,
): VisibleTicket => ({
  fromDivisi: Divisi.IT,
  toDivisi: Divisi.TAX,
  stage,
  rejectedAtStage,
});

const staff = (divisi: Divisi | null) => ({
  role: Role.TEAM_MAIN_OFFICE,
  divisi,
});
const manager = (divisi: Divisi) => ({
  role: Role.MANAGER_MAIN_OFFICE,
  divisi,
});

describe('canViewTicket', () => {
  const stages: TicketStage[] = [
    'MENUNGGU_MANAGER_ASAL',
    'MENUNGGU_MANAGER_TUJUAN',
    'MENUNGGU_STAF_TUJUAN',
    'DIPROSES',
    'SELESAI',
    'DITOLAK',
  ];

  it.each(stages)('lets the superadmin view a ticket at %s', (stage) => {
    expect(
      canViewTicket({ role: Role.SUPERADMIN, divisi: null }, ticket(stage)),
    ).toBe(true);
  });

  it.each(stages)('lets anyone in the origin divisi view at %s', (stage) => {
    expect(canViewTicket(staff(Divisi.IT), ticket(stage))).toBe(true);
    expect(canViewTicket(manager(Divisi.IT), ticket(stage))).toBe(true);
  });

  it.each(stages)('hides the ticket from other divisions at %s', (stage) => {
    expect(canViewTicket(staff(Divisi.LEGAL), ticket(stage))).toBe(false);
    expect(canViewTicket(manager(Divisi.LEGAL), ticket(stage))).toBe(false);
  });

  it('hides the ticket from a non-superadmin without a divisi', () => {
    expect(canViewTicket(staff(null), ticket('SELESAI'))).toBe(false);
  });

  describe('destination divisi', () => {
    it('cannot see the ticket while the origin manager has not approved', () => {
      expect(
        canViewTicket(manager(Divisi.TAX), ticket('MENUNGGU_MANAGER_ASAL')),
      ).toBe(false);
    });

    it('lets only the manager see it while waiting for the destination manager', () => {
      const waiting = ticket('MENUNGGU_MANAGER_TUJUAN');
      expect(canViewTicket(manager(Divisi.TAX), waiting)).toBe(true);
      expect(canViewTicket(staff(Divisi.TAX), waiting)).toBe(false);
    });

    it.each(['MENUNGGU_STAF_TUJUAN', 'DIPROSES', 'SELESAI'] as TicketStage[])(
      'lets staff see it at %s',
      (stage) => {
        expect(canViewTicket(staff(Divisi.TAX), ticket(stage))).toBe(true);
      },
    );

    it('hides a ticket rejected by the origin manager', () => {
      const rejected = ticket('DITOLAK', 'MENUNGGU_MANAGER_ASAL');
      expect(canViewTicket(manager(Divisi.TAX), rejected)).toBe(false);
    });

    it('shows a ticket rejected by the destination manager', () => {
      const rejected = ticket('DITOLAK', 'MENUNGGU_MANAGER_TUJUAN');
      expect(canViewTicket(manager(Divisi.TAX), rejected)).toBe(true);
      expect(canViewTicket(staff(Divisi.TAX), rejected)).toBe(true);
    });
  });
});

describe('canViewAsDestination', () => {
  it('menolak semua peran selama menunggu manager asal', () => {
    expect(
      canViewAsDestination(
        Role.MANAGER_MAIN_OFFICE,
        'MENUNGGU_MANAGER_ASAL',
        null,
      ),
    ).toBe(false);
  });

  it('hanya mengizinkan manager menunggu manager tujuan', () => {
    expect(
      canViewAsDestination(
        Role.FINANCE_MANAGER_MAIN_OFFICE,
        'MENUNGGU_MANAGER_TUJUAN',
        null,
      ),
    ).toBe(true);
    expect(
      canViewAsDestination(
        Role.FINANCE_MAIN_OFFICE,
        'MENUNGGU_MANAGER_TUJUAN',
        null,
      ),
    ).toBe(false);
  });

  it('menyembunyikan penolakan di tahap asal dan menampilkan penolakan di tahap tujuan', () => {
    expect(
      canViewAsDestination(
        Role.TEAM_MAIN_OFFICE,
        'DITOLAK',
        'MENUNGGU_MANAGER_ASAL',
      ),
    ).toBe(false);
    expect(
      canViewAsDestination(
        Role.TEAM_MAIN_OFFICE,
        'DITOLAK',
        'MENUNGGU_MANAGER_TUJUAN',
      ),
    ).toBe(true);
  });
});
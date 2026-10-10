import { TicketStage } from '../../generated/prisma/client';
import { Divisi } from '../../common/enums/divisi.enum';
import { Role } from '../../common/enums/role.enum';
import {
  actionableStages,
  ActableTicket,
  isAuthorizedActor,
  resolveNextStage,
  StageAction,
} from './ticket-stage-flow';

const STAGES: TicketStage[] = [
  'MENUNGGU_MANAGER_ASAL',
  'MENUNGGU_MANAGER_TUJUAN',
  'MENUNGGU_STAF_TUJUAN',
  'DIPROSES',
  'SELESAI',
  'DITOLAK',
];

const ACTIONS: StageAction[] = ['TERIMA', 'TOLAK', 'PROSES', 'SELESAI'];

const VALID_TRANSITIONS: [TicketStage, StageAction, TicketStage][] = [
  ['MENUNGGU_MANAGER_ASAL', 'TERIMA', 'MENUNGGU_MANAGER_TUJUAN'],
  ['MENUNGGU_MANAGER_ASAL', 'TOLAK', 'DITOLAK'],
  ['MENUNGGU_MANAGER_TUJUAN', 'TERIMA', 'MENUNGGU_STAF_TUJUAN'],
  ['MENUNGGU_MANAGER_TUJUAN', 'TOLAK', 'DITOLAK'],
  ['MENUNGGU_STAF_TUJUAN', 'PROSES', 'DIPROSES'],
  ['DIPROSES', 'SELESAI', 'SELESAI'],
];

const ticketAt = (stage: TicketStage): ActableTicket => ({
  fromDivisi: Divisi.IT,
  toDivisi: Divisi.TAX,
  stage,
});

const staff = (divisi: Divisi) => ({ role: Role.TEAM_MAIN_OFFICE, divisi });
const manager = (divisi: Divisi) => ({
  role: Role.MANAGER_MAIN_OFFICE,
  divisi,
});
const superadmin = { role: Role.SUPERADMIN, divisi: null };

describe('resolveNextStage', () => {
  it.each(VALID_TRANSITIONS)(
    'moves %s to the next stage on %s',
    (stage, action, expected) => {
      expect(resolveNextStage(stage, action)).toBe(expected);
    },
  );

  it('allows exactly the six documented transitions and nothing else', () => {
    const allowed = STAGES.flatMap((stage) =>
      ACTIONS.filter((action) => resolveNextStage(stage, action) !== null).map(
        (action) => `${stage}:${action}`,
      ),
    );

    expect(allowed.sort()).toEqual(
      VALID_TRANSITIONS.map(([stage, action]) => `${stage}:${action}`).sort(),
    );
  });

  it.each(['SELESAI', 'DITOLAK'] as TicketStage[])(
    'never leaves the terminal stage %s',
    (stage) => {
      for (const action of ACTIONS) {
        expect(resolveNextStage(stage, action)).toBeNull();
      }
    },
  );

  it('rejects an action that belongs to a different stage', () => {
    expect(resolveNextStage('MENUNGGU_STAF_TUJUAN', 'SELESAI')).toBeNull();
    expect(resolveNextStage('DIPROSES', 'PROSES')).toBeNull();
    expect(resolveNextStage('MENUNGGU_MANAGER_ASAL', 'PROSES')).toBeNull();
  });
});

describe('isAuthorizedActor', () => {
  describe('MENUNGGU_MANAGER_ASAL', () => {
    const ticket = ticketAt('MENUNGGU_MANAGER_ASAL');

    it('accepts only the manager of the origin divisi', () => {
      expect(isAuthorizedActor(manager(Divisi.IT), ticket)).toBe(true);
    });

    it('rejects origin staff, destination people and other divisions', () => {
      expect(isAuthorizedActor(staff(Divisi.IT), ticket)).toBe(false);
      expect(isAuthorizedActor(manager(Divisi.TAX), ticket)).toBe(false);
      expect(isAuthorizedActor(staff(Divisi.TAX), ticket)).toBe(false);
      expect(isAuthorizedActor(manager(Divisi.LEGAL), ticket)).toBe(false);
    });
  });

  describe('MENUNGGU_MANAGER_TUJUAN', () => {
    const ticket = ticketAt('MENUNGGU_MANAGER_TUJUAN');

    it('accepts only the manager of the destination divisi', () => {
      expect(isAuthorizedActor(manager(Divisi.TAX), ticket)).toBe(true);
    });

    it('rejects the origin manager and destination staff', () => {
      expect(isAuthorizedActor(manager(Divisi.IT), ticket)).toBe(false);
      expect(isAuthorizedActor(staff(Divisi.TAX), ticket)).toBe(false);
      expect(isAuthorizedActor(manager(Divisi.LEGAL), ticket)).toBe(false);
    });
  });

  describe.each(['MENUNGGU_STAF_TUJUAN', 'DIPROSES'] as TicketStage[])(
    '%s',
    (stage) => {
      const ticket = ticketAt(stage);

      it('accepts staff of the destination divisi', () => {
        expect(isAuthorizedActor(staff(Divisi.TAX), ticket)).toBe(true);
      });

      it('rejects the destination manager', () => {
        expect(isAuthorizedActor(manager(Divisi.TAX), ticket)).toBe(false);
      });

      it('rejects the origin divisi and other divisions', () => {
        expect(isAuthorizedActor(staff(Divisi.IT), ticket)).toBe(false);
        expect(isAuthorizedActor(manager(Divisi.IT), ticket)).toBe(false);
        expect(isAuthorizedActor(staff(Divisi.LEGAL), ticket)).toBe(false);
        expect(isAuthorizedActor(manager(Divisi.LEGAL), ticket)).toBe(false);
      });
    },
  );

  describe.each(['SELESAI', 'DITOLAK'] as TicketStage[])('%s', (stage) => {
    it('has no authorized actor', () => {
      const ticket = ticketAt(stage);
      expect(isAuthorizedActor(manager(Divisi.IT), ticket)).toBe(false);
      expect(isAuthorizedActor(manager(Divisi.TAX), ticket)).toBe(false);
      expect(isAuthorizedActor(staff(Divisi.TAX), ticket)).toBe(false);
    });
  });

  it.each(STAGES)('never lets the superadmin act at %s', (stage) => {
    expect(isAuthorizedActor(superadmin, ticketAt(stage))).toBe(false);
  });

  it.each(STAGES)('rejects a user without a divisi at %s', (stage) => {
    expect(
      isAuthorizedActor(
        { role: Role.TEAM_MAIN_OFFICE, divisi: null },
        ticketAt(stage),
      ),
    ).toBe(false);
  });

  describe('finance divisi', () => {
    it('lets the finance manager approve a ticket sent from FINANCE', () => {
      const ticket: ActableTicket = {
        fromDivisi: Divisi.FINANCE,
        toDivisi: Divisi.TAX,
        stage: 'MENUNGGU_MANAGER_ASAL',
      };
      expect(
        isAuthorizedActor(
          { role: Role.FINANCE_MANAGER_MAIN_OFFICE, divisi: Divisi.FINANCE },
          ticket,
        ),
      ).toBe(true);
    });

    it('keeps the finance manager out of the staff stages', () => {
      const ticket: ActableTicket = {
        fromDivisi: Divisi.IT,
        toDivisi: Divisi.FINANCE,
        stage: 'MENUNGGU_STAF_TUJUAN',
      };
      expect(
        isAuthorizedActor(
          { role: Role.FINANCE_MANAGER_MAIN_OFFICE, divisi: Divisi.FINANCE },
          ticket,
        ),
      ).toBe(false);
    });

    it('lets finance staff start a ticket sent to FINANCE', () => {
      const ticket: ActableTicket = {
        fromDivisi: Divisi.IT,
        toDivisi: Divisi.FINANCE,
        stage: 'MENUNGGU_STAF_TUJUAN',
      };
      expect(
        isAuthorizedActor(
          { role: Role.FINANCE_MAIN_OFFICE, divisi: Divisi.FINANCE },
          ticket,
        ),
      ).toBe(true);
    });
  });
});

describe('actionableStages', () => {
  it.each([Role.MANAGER_MAIN_OFFICE, Role.FINANCE_MANAGER_MAIN_OFFICE])(
    'memberi manager tahap menunggu manager di kedua sisi (%s)',
    (role) => {
      expect(actionableStages({ role, divisi: Divisi.TAX })).toEqual({
        outgoing: ['MENUNGGU_MANAGER_ASAL'],
        incoming: ['MENUNGGU_MANAGER_TUJUAN'],
      });
    },
  );

  it.each([Role.TEAM_MAIN_OFFICE, Role.FINANCE_MAIN_OFFICE])(
    'memberi staf hanya tahap pengerjaan di sisi masuk (%s)',
    (role) => {
      expect(actionableStages({ role, divisi: Divisi.TAX })).toEqual({
        outgoing: [],
        incoming: ['MENUNGGU_STAF_TUJUAN', 'DIPROSES'],
      });
    },
  );

  it('tidak memberi apa pun kepada superadmin', () => {
    expect(
      actionableStages({ role: Role.SUPERADMIN, divisi: Divisi.TAX }),
    ).toEqual({ outgoing: [], incoming: [] });
  });

  it('memberi hasil sama untuk divisi IT dan divisi lain', () => {
    const role = Role.MANAGER_MAIN_OFFICE;

    expect(actionableStages({ role, divisi: Divisi.IT })).toEqual(
      actionableStages({ role, divisi: Divisi.FINANCE }),
    );
  });
});

import { Divisi } from '../../common/enums/divisi.enum';
import { Role } from '../../common/enums/role.enum';
import { TicketStage } from '../../generated/prisma/client';
import {
  canReadComments,
  canWriteComments,
  COMMENT_MAX_LENGTH,
  isCommentLengthValid,
  isReasonLengthValid,
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
  reasonLabel,
  requiresReason,
} from './ticket-message-rules';
import type { VisibleTicket } from './ticket-visibility';

describe('requiresReason', () => {
  it.each([
    ['TERIMA', true],
    ['TOLAK', true],
    ['PROSES', false],
    ['SELESAI', false],
  ] as const)('%s -> %s', (action, expected) => {
    expect(requiresReason(action)).toBe(expected);
  });
});

describe('isReasonLengthValid', () => {
  it('menerima batas bawah dan batas atas', () => {
    expect(isReasonLengthValid('a'.repeat(REASON_MIN_LENGTH))).toBe(true);
    expect(isReasonLengthValid('a'.repeat(REASON_MAX_LENGTH))).toBe(true);
  });

  it('menolak di luar batas', () => {
    expect(isReasonLengthValid('a'.repeat(REASON_MIN_LENGTH - 1))).toBe(false);
    expect(isReasonLengthValid('a'.repeat(REASON_MAX_LENGTH + 1))).toBe(false);
    expect(isReasonLengthValid('')).toBe(false);
  });

  it('menghitung karakter, bukan unit UTF-16', () => {
    expect(isReasonLengthValid('😀'.repeat(REASON_MIN_LENGTH))).toBe(true);
    expect(isReasonLengthValid('😀'.repeat(REASON_MAX_LENGTH))).toBe(true);
    expect(isReasonLengthValid('😀'.repeat(REASON_MAX_LENGTH + 1))).toBe(false);
  });
});

const ticketIn = (stage: TicketStage): VisibleTicket => ({
  fromDivisi: 'IT',
  toDivisi: 'TAX',
  stage,
  rejectedAtStage: null,
});

const person = (role: Role, divisi: Divisi | null) => ({ role, divisi });

const managerIt = person(Role.MANAGER_MAIN_OFFICE, Divisi.IT);
const managerTax = person(Role.MANAGER_MAIN_OFFICE, Divisi.TAX);
const managerLegal = person(Role.MANAGER_MAIN_OFFICE, Divisi.LEGAL);
const staffIt = person(Role.TEAM_MAIN_OFFICE, Divisi.IT);
const staffTax = person(Role.TEAM_MAIN_OFFICE, Divisi.TAX);
const superadmin = person(Role.SUPERADMIN, null);

describe('canReadComments', () => {
  it.each([
    ['manajer divisi asal', managerIt],
    ['manajer divisi tujuan', managerTax],
    ['superadmin', superadmin],
  ])('mengizinkan %s', (_label, user) => {
    expect(canReadComments(user, ticketIn('DIPROSES'))).toBe(true);
  });

  it.each([
    ['staf divisi asal', staffIt],
    ['staf divisi tujuan', staffTax],
    ['manajer divisi lain', managerLegal],
  ])('menolak %s', (_label, user) => {
    expect(canReadComments(user, ticketIn('DIPROSES'))).toBe(false);
  });

  it('menolak manajer tujuan selama tiket belum terlihat olehnya', () => {
    expect(canReadComments(managerTax, ticketIn('MENUNGGU_MANAGER_ASAL'))).toBe(
      false,
    );
    expect(canReadComments(managerIt, ticketIn('MENUNGGU_MANAGER_ASAL'))).toBe(
      true,
    );
  });

  it('menolak pengguna tanpa divisi yang bukan superadmin', () => {
    expect(
      canReadComments(
        person(Role.MANAGER_MAIN_OFFICE, null),
        ticketIn('DIPROSES'),
      ),
    ).toBe(false);
  });
});

describe('canWriteComments', () => {
  it.each([
    'MENUNGGU_MANAGER_TUJUAN',
    'MENUNGGU_STAF_TUJUAN',
    'DIPROSES',
  ] as const)('mengizinkan kedua manajer pada tahap %s', (stage) => {
    expect(canWriteComments(managerIt, ticketIn(stage))).toBe(true);
    expect(canWriteComments(managerTax, ticketIn(stage))).toBe(true);
  });

  it.each(['MENUNGGU_MANAGER_ASAL', 'SELESAI', 'DITOLAK'] as const)(
    'menolak pada tahap %s',
    (stage) => {
      expect(canWriteComments(managerIt, ticketIn(stage))).toBe(false);
      expect(canWriteComments(managerTax, ticketIn(stage))).toBe(false);
    },
  );

  it.each([
    ['superadmin', superadmin],
    ['staf divisi asal', staffIt],
    ['staf divisi tujuan', staffTax],
    ['manajer divisi lain', managerLegal],
  ])('tidak pernah mengizinkan %s', (_label, user) => {
    expect(canWriteComments(user, ticketIn('DIPROSES'))).toBe(false);
  });
});

describe('isCommentLengthValid', () => {
  it('menerima 1 sampai 1000 karakter', () => {
    expect(isCommentLengthValid('a')).toBe(true);
    expect(isCommentLengthValid('a'.repeat(COMMENT_MAX_LENGTH))).toBe(true);
  });

  it('menolak kosong dan lebih dari 1000 karakter', () => {
    expect(isCommentLengthValid('')).toBe(false);
    expect(isCommentLengthValid('a'.repeat(COMMENT_MAX_LENGTH + 1))).toBe(
      false,
    );
  });

  it('menghitung karakter, bukan unit UTF-16', () => {
    expect(isCommentLengthValid('😀'.repeat(COMMENT_MAX_LENGTH))).toBe(true);
  });
});

describe('reasonLabel', () => {
  it.each([
    ['TERIMA', 'MENUNGGU_MANAGER_ASAL', 'PENGAJUAN'],
    ['TERIMA', 'MENUNGGU_MANAGER_TUJUAN', 'MENERIMA'],
    ['TOLAK', 'MENUNGGU_MANAGER_ASAL', 'MENOLAK'],
    ['TOLAK', 'MENUNGGU_MANAGER_TUJUAN', 'MENOLAK'],
    ['PROSES', 'MENUNGGU_STAF_TUJUAN', null],
    ['SELESAI', 'DIPROSES', null],
    ['DIBUAT', null, null],
    ['TERIMA', null, null],
  ] as const)('%s dari %s -> %s', (action, fromStage, expected) => {
    expect(reasonLabel(action, fromStage)).toBe(expected);
  });
});

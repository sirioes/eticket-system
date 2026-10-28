import { NotFoundException } from '@nestjs/common';
import { AuthUser } from '../../../auth/domain/auth-user';
import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';
import { TICKET_NOT_FOUND_MESSAGE } from '../../attachments/application/use-cases/upload-attachment.use-case';
import type { VisibleTicket } from '../../domain/ticket-visibility';
import {
  TicketMessageRecord,
  TicketMessageRepository,
} from '../ports/ticket-message.repository';
import { TicketQueryRepository } from '../ports/ticket-query.repository';
import { ListTicketMessagesUseCase } from './list-ticket-messages.use-case';

const user = (role: Role, divisi: Divisi | null, id = 21): AuthUser => ({
  id,
  fullName: 'Pengguna Uji',
  role,
  divisi,
  isActive: true,
  passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
});

const managerIt = user(Role.MANAGER_MAIN_OFFICE, Divisi.IT, 12);
const managerTax = user(Role.MANAGER_MAIN_OFFICE, Divisi.TAX, 22);
const managerLegal = user(Role.MANAGER_MAIN_OFFICE, Divisi.LEGAL, 32);
const staffIt = user(Role.TEAM_MAIN_OFFICE, Divisi.IT, 11);
const staffTax = user(Role.TEAM_MAIN_OFFICE, Divisi.TAX, 23);
const superadmin = user(Role.SUPERADMIN, null, 1);

const ticket: VisibleTicket = {
  fromDivisi: Divisi.IT,
  toDivisi: Divisi.TAX,
  stage: 'DIPROSES',
  rejectedAtStage: null,
};

const createdAt = new Date('2026-10-08T01:00:00Z');

const record = (
  overrides: Partial<TicketMessageRecord> = {},
): TicketMessageRecord => ({
  id: 'msg-1',
  kind: 'KOMENTAR',
  body: 'Mohon dilengkapi',
  createdAt,
  author: { fullName: 'Budi Santoso', divisi: Divisi.IT },
  stageLog: null,
  ...overrides,
});

describe('ListTicketMessagesUseCase', () => {
  const tickets = { findVisibilityById: jest.fn() };
  const messages = { listByTicket: jest.fn() };
  const useCase = new ListTicketMessagesUseCase(
    tickets as unknown as TicketQueryRepository,
    messages as unknown as TicketMessageRepository,
  );

  const list = (actor: AuthUser, found: VisibleTicket | null = ticket) => {
    tickets.findVisibilityById.mockResolvedValue(found);
    return useCase.execute({ user: actor, ticketId: 'IT-20261008-001' });
  };

  beforeEach(() => {
    jest.resetAllMocks();
    messages.listByTicket.mockResolvedValue([]);
  });

  it.each([
    ['manager asal', managerIt],
    ['manager tujuan', managerTax],
    ['superadmin', superadmin],
  ])('mengizinkan %s membaca', async (_label, actor) => {
    await expect(list(actor)).resolves.toEqual([]);
    expect(messages.listByTicket).toHaveBeenCalledWith('IT-20261008-001');
  });

  it.each([
    ['staf divisi asal', staffIt],
    ['staf divisi tujuan', staffTax],
    ['manager divisi lain', managerLegal],
  ])('menjawab 404 untuk %s tanpa membaca pesan', async (_label, actor) => {
    await expect(list(actor)).rejects.toThrow(
      new NotFoundException(TICKET_NOT_FOUND_MESSAGE),
    );
    expect(messages.listByTicket).not.toHaveBeenCalled();
  });

  it('menjawab 404 yang sama kalau tiket tidak ada', async () => {
    await expect(list(managerIt, null)).rejects.toThrow(
      new NotFoundException(TICKET_NOT_FOUND_MESSAGE),
    );
  });

  it('memetakan komentar dan label jenis alasan', async () => {
    messages.listByTicket.mockResolvedValue([
      record({ id: 'a' }),
      record({
        id: 'b',
        kind: 'ALASAN',
        stageLog: { action: 'TERIMA', fromStage: 'MENUNGGU_MANAGER_ASAL' },
      }),
      record({
        id: 'c',
        kind: 'ALASAN',
        stageLog: { action: 'TERIMA', fromStage: 'MENUNGGU_MANAGER_TUJUAN' },
      }),
      record({
        id: 'd',
        kind: 'ALASAN',
        stageLog: { action: 'TOLAK', fromStage: 'MENUNGGU_MANAGER_TUJUAN' },
      }),
    ]);

    const result = await list(managerTax);

    expect(result.map((m) => [m.id, m.kind, m.reasonLabel])).toEqual([
      ['a', 'KOMENTAR', null],
      ['b', 'ALASAN', 'PENGAJUAN'],
      ['c', 'ALASAN', 'MENERIMA'],
      ['d', 'ALASAN', 'MENOLAK'],
    ]);
    expect(result[0]).toEqual({
      id: 'a',
      kind: 'KOMENTAR',
      reasonLabel: null,
      body: 'Mohon dilengkapi',
      createdAt,
      author: { fullName: 'Budi Santoso', divisi: Divisi.IT },
    });
  });
});

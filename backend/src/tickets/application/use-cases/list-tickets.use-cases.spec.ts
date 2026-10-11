import { ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../../../auth/domain/auth-user';
import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';
import { TicketQueryRepository } from '../ports/ticket-query.repository';
import { ListIncomingTicketsUseCase } from './list-incoming-tickets.use-case';
import { ListOutgoingTicketsUseCase } from './list-outgoing-tickets.use-case';
import { USER_WITHOUT_DIVISI_MESSAGE } from './ticket-list-query';

const user = (role: Role, divisi: Divisi | null): AuthUser => ({
  id: 11,
  fullName: 'Ayu Lestari',
  role,
  divisi,
  isActive: true,
  passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
});

const emptyPage = { items: [], total: 0 };

describe('ListOutgoingTicketsUseCase', () => {
  const tickets = { listOutgoing: jest.fn() };
  const useCase = new ListOutgoingTicketsUseCase(
    tickets as unknown as TicketQueryRepository,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    tickets.listOutgoing.mockResolvedValue(emptyPage);
  });

  it('membatasi daftar ke divisi pengguna, bukan ke input klien', async () => {
    await useCase.execute({
      user: user(Role.TEAM_MAIN_OFFICE, Divisi.IT),
      page: 2,
      limit: 25,
      search: 'IT-2026',
      divisi: Divisi.TAX,
    });

    expect(tickets.listOutgoing).toHaveBeenCalledWith(
      { fromDivisi: Divisi.IT },
      { search: 'IT-2026', counterpartDivisi: Divisi.TAX },
      { page: 2, limit: 25 },
    );
  });

  it('mengembalikan tampilan dengan halaman dan total halaman', async () => {
    tickets.listOutgoing.mockResolvedValue({ items: [], total: 31 });

    const view = await useCase.execute({
      user: user(Role.MANAGER_MAIN_OFFICE, Divisi.IT),
      page: 1,
      limit: 10,
    });

    expect(view).toMatchObject({
      total: 31,
      page: 1,
      limit: 10,
      totalPages: 4,
    });
  });

  it('menolak pengguna tanpa divisi sebelum menyentuh data', async () => {
    await expect(
      useCase.execute({
        user: user(Role.SUPERADMIN, null),
        page: 1,
        limit: 10,
      }),
    ).rejects.toThrow(new ForbiddenException(USER_WITHOUT_DIVISI_MESSAGE));
    expect(tickets.listOutgoing).not.toHaveBeenCalled();
  });

  it('menolak rentang tanggal terbalik sebelum menyentuh data', async () => {
    await expect(
      useCase.execute({
        user: user(Role.TEAM_MAIN_OFFICE, Divisi.IT),
        page: 1,
        limit: 10,
        dateFrom: '2026-10-09',
        dateTo: '2026-10-08',
      }),
    ).rejects.toThrow();
    expect(tickets.listOutgoing).not.toHaveBeenCalled();
  });
});

describe('ListIncomingTicketsUseCase', () => {
  const tickets = { listIncoming: jest.fn() };
  const useCase = new ListIncomingTicketsUseCase(
    tickets as unknown as TicketQueryRepository,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    tickets.listIncoming.mockResolvedValue(emptyPage);
  });

  it('meneruskan peran dan divisi pengguna sebagai pemirsa', async () => {
    await useCase.execute({
      user: user(Role.MANAGER_MAIN_OFFICE, Divisi.TAX),
      page: 1,
      limit: 10,
      status: 'MENUNGGU_MANAGER_TUJUAN',
      divisi: Divisi.IT,
    });

    expect(tickets.listIncoming).toHaveBeenCalledWith(
      { viewer: { role: Role.MANAGER_MAIN_OFFICE, divisi: Divisi.TAX } },
      { stage: 'MENUNGGU_MANAGER_TUJUAN', counterpartDivisi: Divisi.IT },
      { page: 1, limit: 10 },
    );
  });

  it('menolak pengguna tanpa divisi sebelum menyentuh data', async () => {
    await expect(
      useCase.execute({
        user: user(Role.SUPERADMIN, null),
        page: 1,
        limit: 10,
      }),
    ).rejects.toThrow(new ForbiddenException(USER_WITHOUT_DIVISI_MESSAGE));
    expect(tickets.listIncoming).not.toHaveBeenCalled();
  });
});

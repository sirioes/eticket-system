import { ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../../../auth/domain/auth-user';
import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';
import { TicketQueryRepository } from '../ports/ticket-query.repository';
import { GetTicketStatsUseCase } from './get-ticket-stats.use-case';
import { USER_WITHOUT_DIVISI_MESSAGE } from './ticket-list-query';

const user = (role: Role, divisi: Divisi | null): AuthUser => ({
  id: 11,
  fullName: 'Ayu Lestari',
  role,
  divisi,
  isActive: true,
  passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
});

describe('GetTicketStatsUseCase', () => {
  const tickets = { countOutgoing: jest.fn(), countIncoming: jest.fn() };
  const useCase = new GetTicketStatsUseCase(
    tickets as unknown as TicketQueryRepository,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    tickets.countOutgoing.mockResolvedValue(35);
    tickets.countIncoming.mockImplementation(
      async (_scope: unknown, filter: { stage?: string }) =>
        filter.stage === 'SELESAI' ? 20 : 45,
    );
  });

  it('menjumlahkan keluar dan masuk menjadi total', async () => {
    await expect(
      useCase.execute(user(Role.TEAM_MAIN_OFFICE, Divisi.TAX)),
    ).resolves.toEqual({ total: 80, incoming: 45, outgoing: 35, selesai: 20 });
  });

  it('menghitung selesai hanya dari tiket masuk', async () => {
    await useCase.execute(user(Role.TEAM_MAIN_OFFICE, Divisi.TAX));

    expect(tickets.countOutgoing).toHaveBeenCalledTimes(1);
    expect(tickets.countOutgoing).toHaveBeenCalledWith(
      { fromDivisi: Divisi.TAX },
      {},
    );
    expect(tickets.countIncoming).toHaveBeenCalledWith(
      { viewer: { role: Role.TEAM_MAIN_OFFICE, divisi: Divisi.TAX } },
      { stage: 'SELESAI' },
    );
  });

  it('memakai aturan visibilitas masuk sesuai peran pemirsa', async () => {
    await useCase.execute(user(Role.MANAGER_MAIN_OFFICE, Divisi.IT));

    expect(tickets.countIncoming).toHaveBeenCalledWith(
      { viewer: { role: Role.MANAGER_MAIN_OFFICE, divisi: Divisi.IT } },
      {},
    );
  });

  it('menolak pengguna tanpa divisi sebelum menyentuh data', async () => {
    await expect(useCase.execute(user(Role.SUPERADMIN, null))).rejects.toThrow(
      new ForbiddenException(USER_WITHOUT_DIVISI_MESSAGE),
    );
    expect(tickets.countOutgoing).not.toHaveBeenCalled();
    expect(tickets.countIncoming).not.toHaveBeenCalled();
  });
});

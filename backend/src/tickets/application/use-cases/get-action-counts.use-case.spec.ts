import { ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../../../auth/domain/auth-user';
import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';
import { TicketQueryRepository } from '../ports/ticket-query.repository';
import { GetActionCountsUseCase } from './get-action-counts.use-case';
import { USER_WITHOUT_DIVISI_MESSAGE } from './ticket-list-query';

const user = (role: Role, divisi: Divisi | null): AuthUser => ({
  id: 11,
  fullName: 'Ayu Lestari',
  role,
  divisi,
  isActive: true,
  passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
});

describe('GetActionCountsUseCase', () => {
  const tickets = {
    countOutgoingInStages: jest.fn(),
    countIncomingInStages: jest.fn(),
  };
  const useCase = new GetActionCountsUseCase(
    tickets as unknown as TicketQueryRepository,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    tickets.countOutgoingInStages.mockResolvedValue(3);
    tickets.countIncomingInStages.mockResolvedValue(5);
  });

  it.each([Role.MANAGER_MAIN_OFFICE, Role.FINANCE_MANAGER_MAIN_OFFICE])(
    'menghitung persetujuan manager di sisi keluar dan masuk (%s)',
    async (role) => {
      await expect(useCase.execute(user(role, Divisi.TAX))).resolves.toEqual({
        outgoing: 3,
        incoming: 5,
      });

      expect(tickets.countOutgoingInStages).toHaveBeenCalledWith(Divisi.TAX, [
        'MENUNGGU_MANAGER_ASAL',
      ]);
      expect(tickets.countIncomingInStages).toHaveBeenCalledWith(Divisi.TAX, [
        'MENUNGGU_MANAGER_TUJUAN',
      ]);
    },
  );

  it.each([Role.TEAM_MAIN_OFFICE, Role.FINANCE_MAIN_OFFICE])(
    'menghitung pekerjaan staf hanya di sisi masuk (%s)',
    async (role) => {
      await expect(useCase.execute(user(role, Divisi.TAX))).resolves.toEqual({
        outgoing: 0,
        incoming: 5,
      });

      expect(tickets.countOutgoingInStages).not.toHaveBeenCalled();
      expect(tickets.countIncomingInStages).toHaveBeenCalledWith(Divisi.TAX, [
        'MENUNGGU_STAF_TUJUAN',
        'DIPROSES',
      ]);
    },
  );

  it('menolak pengguna tanpa divisi', async () => {
    await expect(useCase.execute(user(Role.SUPERADMIN, null))).rejects.toThrow(
      new ForbiddenException(USER_WITHOUT_DIVISI_MESSAGE),
    );
    expect(tickets.countIncomingInStages).not.toHaveBeenCalled();
  });
});

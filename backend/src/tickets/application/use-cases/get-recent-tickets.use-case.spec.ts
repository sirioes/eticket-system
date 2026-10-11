import { ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../../../auth/domain/auth-user';
import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';
import { TicketQueryRepository } from '../ports/ticket-query.repository';
import {
  GetRecentTicketsUseCase,
  RECENT_TICKETS_LIMIT,
} from './get-recent-tickets.use-case';
import { USER_WITHOUT_DIVISI_MESSAGE } from './ticket-list-query';

const user = (role: Role, divisi: Divisi | null): AuthUser => ({
  id: 11,
  fullName: 'Ayu Lestari',
  role,
  divisi,
  isActive: true,
  passwordChangedAt: new Date('2026-01-01T00:00:00Z'),
});

describe('GetRecentTicketsUseCase', () => {
  const tickets = { listRecent: jest.fn() };
  const useCase = new GetRecentTicketsUseCase(
    tickets as unknown as TicketQueryRepository,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    tickets.listRecent.mockResolvedValue([]);
  });

  it('meminta tujuh tiket terbaru dengan lingkup keluar dan masuk milik pengguna', async () => {
    await useCase.execute(user(Role.MANAGER_MAIN_OFFICE, Divisi.TAX));

    expect(RECENT_TICKETS_LIMIT).toBe(7);
    expect(tickets.listRecent).toHaveBeenCalledWith(
      { fromDivisi: Divisi.TAX },
      { viewer: { role: Role.MANAGER_MAIN_OFFICE, divisi: Divisi.TAX } },
      7,
    );
  });

  it('memotong deskripsi menjadi pratinjau dan membawa jumlah lampiran', async () => {
    tickets.listRecent.mockResolvedValue([
      {
        id: 'IT-20261011-0001',
        description: 'x'.repeat(300),
        stage: 'DIPROSES',
        fromDivisi: Divisi.IT,
        toDivisi: Divisi.TAX,
        createdAt: new Date('2026-10-11T02:00:00Z'),
        attachmentCount: 2,
      },
    ]);

    const [view] = await useCase.execute(
      user(Role.TEAM_MAIN_OFFICE, Divisi.TAX),
    );

    expect(view).toMatchObject({
      id: 'IT-20261011-0001',
      stage: 'DIPROSES',
      attachmentCount: 2,
    });
    expect(view.descriptionPreview.length).toBeLessThan(300);
    expect(view).not.toHaveProperty('description');
  });

  it('menolak pengguna tanpa divisi sebelum menyentuh data', async () => {
    await expect(useCase.execute(user(Role.SUPERADMIN, null))).rejects.toThrow(
      new ForbiddenException(USER_WITHOUT_DIVISI_MESSAGE),
    );
    expect(tickets.listRecent).not.toHaveBeenCalled();
  });
});

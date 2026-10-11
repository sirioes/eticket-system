import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../../../auth/domain/auth-user';
import { Divisi } from '../../../common/enums/divisi.enum';
import { TicketStage } from '../../../generated/prisma/client';
import { toDescriptionPreview } from '../../domain/ticket-rules';
import {
  startOfNextWitaDay,
  startOfWitaDay,
} from '../../domain/wita-date-range';
import { TicketListFilter, TicketPage } from '../ports/ticket-query.repository';

export const USER_WITHOUT_DIVISI_MESSAGE =
  'Akun tanpa divisi tidak memiliki daftar pengaduan';

export const INVALID_DATE_MESSAGE = 'Format tanggal tidak valid';

export const INVALID_DATE_RANGE_MESSAGE =
  'Tanggal awal tidak boleh setelah tanggal akhir';

export interface TicketListQuery {
  readonly user: AuthUser;
  readonly page: number;
  readonly limit: number;
  readonly search?: string;
  readonly status?: TicketStage;
  readonly divisi?: Divisi;
  readonly dateFrom?: string;
  readonly dateTo?: string;
}

export interface TicketListItemView {
  readonly id: string;
  readonly descriptionPreview: string;
  readonly stage: TicketStage;
  readonly fromDivisi: `${Divisi}`;
  readonly toDivisi: `${Divisi}`;
  readonly createdAt: Date;
  readonly attachmentCount: number;
}

export interface TicketListView {
  readonly items: TicketListItemView[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
}

export function requireDivisi(user: Pick<AuthUser, 'divisi'>): Divisi {
  if (user.divisi === null) {
    throw new ForbiddenException(USER_WITHOUT_DIVISI_MESSAGE);
  }
  return user.divisi;
}

export function toTicketListFilter(
  query: Pick<
    TicketListQuery,
    'search' | 'status' | 'divisi' | 'dateFrom' | 'dateTo'
  >,
): TicketListFilter {
  const createdFrom =
    query.dateFrom === undefined ? undefined : startOfWitaDay(query.dateFrom);
  const createdBefore =
    query.dateTo === undefined ? undefined : startOfNextWitaDay(query.dateTo);

  if (createdFrom === null || createdBefore === null) {
    throw new BadRequestException(INVALID_DATE_MESSAGE);
  }
  if (
    createdFrom !== undefined &&
    createdBefore !== undefined &&
    createdFrom >= createdBefore
  ) {
    throw new BadRequestException(INVALID_DATE_RANGE_MESSAGE);
  }

  return {
    ...(query.search !== undefined && { search: query.search }),
    ...(query.status !== undefined && { stage: query.status }),
    ...(query.divisi !== undefined && { counterpartDivisi: query.divisi }),
    ...(createdFrom !== undefined && { createdFrom }),
    ...(createdBefore !== undefined && { createdBefore }),
  };
}

export function toTicketListView(
  page: TicketPage,
  pagination: Pick<TicketListQuery, 'page' | 'limit'>,
): TicketListView {
  return {
    items: page.items.map((ticket) => ({
      id: ticket.id,
      descriptionPreview: toDescriptionPreview(ticket.description),
      stage: ticket.stage,
      fromDivisi: ticket.fromDivisi,
      toDivisi: ticket.toDivisi,
      createdAt: ticket.createdAt,
      attachmentCount: ticket.attachmentCount,
    })),
    total: page.total,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: Math.ceil(page.total / pagination.limit),
  };
}

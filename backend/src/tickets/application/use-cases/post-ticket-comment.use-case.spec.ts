import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../../../auth/domain/auth-user';
import { Divisi } from '../../../common/enums/divisi.enum';
import { Role } from '../../../common/enums/role.enum';
import { TICKET_NOT_FOUND_MESSAGE } from '../../attachments/application/use-cases/upload-attachment.use-case';
import { MAX_MESSAGES_PER_TICKET } from '../../domain/ticket-message-rules';
import type { VisibleTicket } from '../../domain/ticket-visibility';
import {
  MessageContentionError,
  TicketMessageRecord,
  TicketMessageRepository,
} from '../ports/ticket-message.repository';
import { TicketQueryRepository } from '../ports/ticket-query.repository';
import {
  COMMENT_BUSY_MESSAGE,
  COMMENT_CLOSED_MESSAGE,
  COMMENT_INVALID_CHARACTER_MESSAGE,
  COMMENT_LENGTH_MESSAGE,
  MESSAGE_LIMIT_MESSAGE,
  PostTicketCommentUseCase,
} from './post-ticket-comment.use-case';

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

const ticket = (stage: VisibleTicket['stage']): VisibleTicket => ({
  fromDivisi: Divisi.IT,
  toDivisi: Divisi.TAX,
  stage,
  rejectedAtStage: null,
});

const created: TicketMessageRecord = {
  id: 'msg-1',
  kind: 'KOMENTAR',
  body: 'Mohon dilengkapi',
  createdAt: new Date('2026-10-08T01:00:00Z'),
  author: { fullName: 'Pengguna Uji', divisi: Divisi.TAX },
  stageLog: null,
};

describe('PostTicketCommentUseCase', () => {
  const tickets = { findVisibilityById: jest.fn() };
  const messages = { createComment: jest.fn() };
  const useCase = new PostTicketCommentUseCase(
    tickets as unknown as TicketQueryRepository,
    messages as unknown as TicketMessageRepository,
  );

  const post = (
    actor: AuthUser,
    body = 'Mohon dilengkapi',
    found: VisibleTicket | null = ticket('DIPROSES'),
  ) => {
    tickets.findVisibilityById.mockResolvedValue(found);
    return useCase.execute({ user: actor, ticketId: 'IT-20261008-001', body });
  };

  beforeEach(() => {
    jest.resetAllMocks();
    messages.createComment.mockResolvedValue(created);
  });

  it.each([
    ['manager asal', managerIt],
    ['manager tujuan', managerTax],
  ])('mengizinkan %s menulis', async (_label, actor) => {
    await expect(post(actor)).resolves.toMatchObject({
      id: 'msg-1',
      kind: 'KOMENTAR',
      reasonLabel: null,
    });
    expect(messages.createComment).toHaveBeenCalledWith({
      ticketId: 'IT-20261008-001',
      authorId: actor.id,
      body: 'Mohon dilengkapi',
      limit: MAX_MESSAGES_PER_TICKET,
    });
  });

  it.each([
    ['superadmin', superadmin],
    ['staf divisi asal', staffIt],
    ['staf divisi tujuan', staffTax],
    ['manager divisi lain', managerLegal],
  ])('menjawab 404 untuk %s', async (_label, actor) => {
    await expect(post(actor)).rejects.toThrow(
      new NotFoundException(TICKET_NOT_FOUND_MESSAGE),
    );
    expect(messages.createComment).not.toHaveBeenCalled();
  });

  it('menjawab 404 kalau tiket tidak ada', async () => {
    await expect(post(managerIt, 'Halo', null)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each(['MENUNGGU_MANAGER_ASAL', 'SELESAI', 'DITOLAK'] as const)(
    'menjawab 409 pada tahap %s',
    async (stage) => {
      await expect(post(managerIt, 'Halo', ticket(stage))).rejects.toThrow(
        new ConflictException(COMMENT_CLOSED_MESSAGE),
      );
      expect(messages.createComment).not.toHaveBeenCalled();
    },
  );

  it('menyeragamkan baris baru dan memangkas spasi tepi', async () => {
    await post(managerIt, '  baris satu\r\nbaris dua  ');

    expect(messages.createComment.mock.calls[0][0].body).toBe(
      'baris satu\nbaris dua',
    );
  });

  it.each([
    ['kosong', ''],
    ['hanya spasi', '  \n\t '],
    ['1001 karakter', 'a'.repeat(1001)],
  ])('menjawab 400 untuk komentar %s', async (_label, body) => {
    await expect(post(managerIt, body)).rejects.toThrow(
      new BadRequestException(COMMENT_LENGTH_MESSAGE),
    );
    expect(messages.createComment).not.toHaveBeenCalled();
  });

  it('menerima komentar 1 dan 1000 karakter', async () => {
    await expect(post(managerIt, 'a')).resolves.toBeDefined();
    await expect(post(managerIt, 'a'.repeat(1000))).resolves.toBeDefined();
  });

  it.each([
    ['karakter kontrol', 'komentar\u0007 valid'],
    ['pengarah teks unicode', 'komentar‮ valid'],
    ['lebar nol', 'komentar​ valid'],
    ['surrogate tunggal', 'komentar \uD800 valid'],
  ])('menolak komentar berisi %s', async (_label, body) => {
    await expect(post(managerIt, body)).rejects.toThrow(
      new BadRequestException(COMMENT_INVALID_CHARACTER_MESSAGE),
    );
  });

  it('menyimpan teks apa adanya tanpa mengubah markup', async () => {
    await post(managerIt, '<img src=x onerror=alert(1)>');

    expect(messages.createComment.mock.calls[0][0].body).toBe(
      '<img src=x onerror=alert(1)>',
    );
  });

  it('menjawab 409 kalau batas pesan tercapai', async () => {
    messages.createComment.mockResolvedValue(null);

    await expect(post(managerIt)).rejects.toThrow(
      new ConflictException(MESSAGE_LIMIT_MESSAGE),
    );
  });

  it('menjawab 409 kalau kunci pengaduan menunggu terlalu lama', async () => {
    messages.createComment.mockRejectedValue(new MessageContentionError());

    await expect(post(managerIt)).rejects.toThrow(
      new ConflictException(COMMENT_BUSY_MESSAGE),
    );
  });

  it('meneruskan galat tak terduga', async () => {
    const failure = new Error('db mati');
    messages.createComment.mockRejectedValue(failure);

    await expect(post(managerIt)).rejects.toBe(failure);
  });
});

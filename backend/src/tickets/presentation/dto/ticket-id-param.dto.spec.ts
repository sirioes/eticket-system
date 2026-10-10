import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { VALIDATION_PIPE_OPTIONS } from '../../../app.setup';
import { TicketIdParamDto } from './ticket-id-param.dto';

const pipe = new ValidationPipe(VALIDATION_PIPE_OPTIONS);

const parse = (params: Record<string, unknown>) =>
  pipe.transform(params, {
    type: 'param',
    metatype: TicketIdParamDto,
  } as ArgumentMetadata) as Promise<TicketIdParamDto>;

describe('TicketIdParamDto', () => {
  it.each(['IT-2026-0001', 'LGL-20260101-001', 'abc123', 'A'])(
    'menerima id %p',
    async (id) => {
      await expect(parse({ id })).resolves.toMatchObject({ id });
    },
  );

  it.each([
    ['garis bawah', 'IT_2026'],
    ['spasi', 'IT 2026'],
    ['wildcard LIKE', 'IT%'],
    ['path traversal', '..%2f..%2fetc'],
    ['titik', 'IT.2026'],
    ['tanda kutip', "IT'2026"],
    ['kosong', ''],
    ['terlalu panjang', 'A'.repeat(101)],
  ])('menolak id dengan %s', async (_label, id) => {
    await expect(parse({ id })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('menerima id sepanjang tepat 100 karakter', async () => {
    await expect(parse({ id: 'A'.repeat(100) })).resolves.toBeDefined();
  });

  it('menolak parameter tambahan yang tidak dikenal', async () => {
    await expect(parse({ id: 'IT-1', extra: 'x' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { VALIDATION_PIPE_OPTIONS } from '../../../app.setup';
import { CreateTicketMessageDto } from './create-ticket-message.dto';

const pipe = new ValidationPipe(VALIDATION_PIPE_OPTIONS);

const parse = (body: unknown) =>
  pipe.transform(body, {
    type: 'body',
    metatype: CreateTicketMessageDto,
  } as ArgumentMetadata) as Promise<CreateTicketMessageDto>;

describe('CreateTicketMessageDto', () => {
  it('menerima komentar berupa teks', async () => {
    await expect(parse({ body: 'Mohon dilengkapi' })).resolves.toMatchObject({
      body: 'Mohon dilengkapi',
    });
  });

  it.each([
    ['tanpa body', {}],
    ['angka', { body: 5 }],
    ['null', { body: null }],
    ['array', { body: ['a'] }],
    ['objek', { body: { text: 'a' } }],
    ['terlalu panjang', { body: 'a'.repeat(2001) }],
  ])('menolak %s', async (_label, body) => {
    await expect(parse(body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['kind', 'authorId', 'ticketId', 'stageLogId'])(
    'menolak body yang mencoba mengirim %s',
    async (field) => {
      await expect(
        parse({ body: 'Komentar', [field]: 'ALASAN' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});

import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { VALIDATION_PIPE_OPTIONS } from '../../../app.setup';
import { AdvanceTicketStageDto } from './advance-ticket-stage.dto';

const pipe = new ValidationPipe(VALIDATION_PIPE_OPTIONS);

const parse = (body: unknown) =>
  pipe.transform(body, {
    type: 'body',
    metatype: AdvanceTicketStageDto,
  } as ArgumentMetadata) as Promise<AdvanceTicketStageDto>;

describe('AdvanceTicketStageDto', () => {
  it.each(['TERIMA', 'TOLAK', 'PROSES', 'SELESAI'])(
    'menerima aksi %s',
    async (action) => {
      await expect(parse({ action })).resolves.toMatchObject({ action });
    },
  );

  it.each([
    ['aksi tidak dikenal', { action: 'BATAL' }],
    ['huruf kecil', { action: 'terima' }],
    ['spasi di tepi', { action: ' TERIMA ' }],
    ['tanpa aksi', {}],
    ['aksi kosong', { action: '' }],
    ['aksi null', { action: null }],
    ['aksi berupa angka', { action: 1 }],
    ['aksi berupa array', { action: ['TERIMA'] }],
    ['aksi berupa objek', { action: { value: 'TERIMA' } }],
  ])('menolak %s', async (_label, body) => {
    await expect(parse(body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['stage', 'nextStage', 'actorId', 'rejectedById'])(
    'menolak body yang mencoba mengirim %s',
    async (field) => {
      await expect(
        parse({ action: 'TERIMA', [field]: 'DIPROSES' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('menolak body yang bukan objek', async () => {
    await expect(parse('TERIMA')).rejects.toBeInstanceOf(BadRequestException);
  });
});

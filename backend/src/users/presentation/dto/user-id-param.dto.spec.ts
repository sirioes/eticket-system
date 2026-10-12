import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { VALIDATION_PIPE_OPTIONS } from '../../../app.setup';
import { MAX_USER_ID, UserIdParamDto } from './user-id-param.dto';

const pipe = new ValidationPipe(VALIDATION_PIPE_OPTIONS);

const parse = (params: unknown) =>
  pipe.transform(params, {
    type: 'param',
    metatype: UserIdParamDto,
  } as ArgumentMetadata) as Promise<UserIdParamDto>;

describe('UserIdParamDto', () => {
  it.each([
    ['1', 1],
    ['42', 42],
    [String(MAX_USER_ID), MAX_USER_ID],
  ])('turns %s into the number %d', async (id, expected) => {
    await expect(parse({ id })).resolves.toEqual({ id: expected });
  });

  it.each([
    ['zero', '0'],
    ['a negative number', '-1'],
    ['text', 'abc'],
    ['a decimal', '1.5'],
    ['an empty string', ''],
    ['blank spaces', '   '],
    ['a number beyond the INT range', String(MAX_USER_ID + 1)],
    ['a very long number', '9'.repeat(30)],
    ['a SQL-looking string', '1 OR 1=1'],
  ])('rejects %s', async (_label, id) => {
    await expect(parse({ id })).rejects.toBeInstanceOf(BadRequestException);
  });
});

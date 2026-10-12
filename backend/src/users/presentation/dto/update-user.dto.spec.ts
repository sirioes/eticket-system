import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { VALIDATION_PIPE_OPTIONS } from '../../../app.setup';
import { UpdateUserDto } from './update-user.dto';

const pipe = new ValidationPipe(VALIDATION_PIPE_OPTIONS);

const parse = (body: unknown) =>
  pipe.transform(body, {
    type: 'body',
    metatype: UpdateUserDto,
  } as ArgumentMetadata) as Promise<UpdateUserDto>;

describe('UpdateUserDto', () => {
  it.each([
    ['an empty body', {}],
    ['a role', { role: 'MANAGER_MAIN_OFFICE' }],
    ['a divisi', { divisi: 'IT' }],
    ['a null divisi', { divisi: null }],
    ['isActive false', { isActive: false }],
    ['isActive true', { isActive: true }],
    [
      'all three fields',
      { role: 'TEAM_MAIN_OFFICE', divisi: 'TAX', isActive: true },
    ],
  ])('accepts %s', async (_label, body) => {
    await expect(parse(body)).resolves.toMatchObject(body);
  });

  it.each([
    ['a null role', { role: null }],
    ['an empty role', { role: '' }],
    ['an unknown role', { role: 'ADMIN' }],
    ['a role that is a number', { role: 1 }],
    ['an unknown divisi', { divisi: 'MARS' }],
    ['an empty divisi', { divisi: '' }],
    ['a null isActive', { isActive: null }],
    ['isActive as a string', { isActive: 'false' }],
    ['isActive as a number', { isActive: 0 }],
    ['isActive as an array', { isActive: [false] }],
  ])('rejects %s', async (_label, body) => {
    await expect(parse(body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['fullName', 'password', 'passwordHash', 'passwordChangedAt', 'id'])(
    'rejects a body that tries to send %s',
    async (field) => {
      await expect(
        parse({ isActive: true, [field]: 'x' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});

import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { VALIDATION_PIPE_OPTIONS } from '../../../app.setup';
import { CreateUserDto } from './create-user.dto';

const pipe = new ValidationPipe(VALIDATION_PIPE_OPTIONS);

const parse = (body: unknown) =>
  pipe.transform(body, {
    type: 'body',
    metatype: CreateUserDto,
  } as ArgumentMetadata) as Promise<CreateUserDto>;

const valid = {
  fullName: 'Rina Wulandari TX01',
  role: 'TEAM_MAIN_OFFICE',
  divisi: 'TAX',
  password: 'password-awal-1',
};

describe('CreateUserDto', () => {
  it.each([
    ['with a divisi', valid],
    ['without a divisi', { ...valid, role: 'SUPERADMIN', divisi: undefined }],
    ['with a null divisi', { ...valid, role: 'SUPERADMIN', divisi: null }],
  ])('accepts a body %s', async (_label, body) => {
    await expect(parse(body)).resolves.toMatchObject({ role: body.role });
  });

  it.each([
    ['a missing name', { ...valid, fullName: undefined }],
    ['an empty name', { ...valid, fullName: '' }],
    ['an oversized name', { ...valid, fullName: 'x'.repeat(192) }],
    ['a name that is an object', { ...valid, fullName: { contains: '' } }],
    ['a missing role', { ...valid, role: undefined }],
    ['an unknown role', { ...valid, role: 'ADMIN' }],
    ['a lowercase role', { ...valid, role: 'superadmin' }],
    ['an unknown divisi', { ...valid, divisi: 'MARS' }],
    ['an empty divisi', { ...valid, divisi: '' }],
    ['a missing password', { ...valid, password: undefined }],
    ['a password that is a number', { ...valid, password: 12345678 }],
    ['a password that is an object', { ...valid, password: { not: '' } }],
  ])('rejects %s', async (_label, body) => {
    await expect(parse(body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['id', 'isActive', 'passwordHash', 'passwordChangedAt', 'createdAt'])(
    'rejects a body that tries to send %s',
    async (field) => {
      await expect(parse({ ...valid, [field]: 1 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );
});

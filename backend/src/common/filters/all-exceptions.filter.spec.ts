import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  return { status: status.mock.calls[0][0], body: json.mock.calls[0][0] };
}

describe('AllExceptionsFilter', () => {
  it('passes through an HttpException with string response', () => {
    const { status, body } = run(new ForbiddenException('nope'));
    expect(status).toBe(403);
    expect(body).toEqual({
      statusCode: 403,
      error: 'Forbidden',
      message: 'nope',
    });
  });

  it('spreads an HttpException object response', () => {
    const { status, body } = run(new BadRequestException(['a must be string']));
    expect(status).toBe(400);
    expect(body).toMatchObject({
      statusCode: 400,
      message: ['a must be string'],
    });
  });

  it('exposes a body-parser style 4xx error (413)', () => {
    const { status, body } = run(
      Object.assign(new Error('request entity too large'), {
        status: 413,
        expose: true,
      }),
    );
    expect(status).toBe(413);
    expect(body).toEqual({
      statusCode: 413,
      message: 'request entity too large',
    });
  });

  it('hides a 4xx-looking error when expose is not true', () => {
    const { status, body } = run(
      Object.assign(new Error('secret detail'), { status: 400 }),
    );
    expect(status).toBe(500);
    expect(body).toEqual({ statusCode: 500, message: 'Internal server error' });
  });

  it.each([500, 399, 600, 413.5])(
    'never exposes status %p from a non-HttpException',
    (code) => {
      const { status, body } = run(
        Object.assign(new Error('x'), { status: code, expose: true }),
      );
      expect(status).toBe(500);
      expect(body.message).toBe('Internal server error');
    },
  );

  it.each([new Error('db password leaked'), 'string', null, undefined, 42])(
    'returns a generic 500 for %p',
    (value) => {
      const { status, body } = run(value);
      expect(status).toBe(500);
      expect(body).toEqual({
        statusCode: 500,
        message: 'Internal server error',
      });
    },
  );
});

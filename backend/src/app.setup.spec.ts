import { Controller, Get, INestApplication, Req } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import { configureApp } from './app.setup';

jest.setTimeout(30000);

@Controller('probe')
class ProbeController {
  @Get('ip')
  ip(@Req() req: Request) {
    return { ip: req.ip };
  }
}

describe('configureApp trust proxy', () => {
  const FORGED = '6.6.6.6';
  const OUTER_PROXY = '198.51.100.7';
  const CLIENT = '203.0.113.9';
  const previousHops = process.env.TRUST_PROXY_HOPS;

  let app: INestApplication | undefined;

  const start = async (hops: string | undefined) => {
    if (hops === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = hops;

    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  };

  const ipSeenFor = async (forwardedFor?: string) => {
    const call = request(app!.getHttpServer()).get('/probe/ip');
    const response = await (forwardedFor ? call.set('X-Forwarded-For', forwardedFor) : call);
    return response.body.ip as string;
  };

  afterEach(async () => {
    await app?.close();
    app = undefined;
    if (previousHops === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = previousHops;
  });

  it('trusts exactly one hop when TRUST_PROXY_HOPS is not set', async () => {
    await start(undefined);

    expect(await ipSeenFor(`${FORGED}, ${CLIENT}`)).toBe(CLIENT);
  });

  it('ignores X-Forwarded-For entirely with zero hops', async () => {
    await start('0');

    expect(await ipSeenFor(`${FORGED}, ${CLIENT}`)).toMatch(/127\.0\.0\.1$/);
  });

  it('falls back to the connecting address when no header is sent', async () => {
    await start('1');

    expect(await ipSeenFor()).toMatch(/127\.0\.0\.1$/);
  });

  it('skips one extra entry per additional trusted hop', async () => {
    await start('2');

    expect(await ipSeenFor(`${FORGED}, ${OUTER_PROXY}, ${CLIENT}`)).toBe(OUTER_PROXY);
  });

  it.each([['true'], ['-1'], ['loopback']])(
    'refuses to start with TRUST_PROXY_HOPS=%s',
    async (hops) => {
      await expect(start(hops)).rejects.toThrow('TRUST_PROXY_HOPS');
    },
  );
});

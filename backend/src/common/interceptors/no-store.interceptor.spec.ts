import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import {
  NO_STORE_CACHE_CONTROL,
  NoStoreInterceptor,
} from './no-store.interceptor';

describe('NoStoreInterceptor', () => {
  it('memasang Cache-Control private, no-store sebelum handler berjalan', async () => {
    const setHeader = jest.fn();
    const context = {
      switchToHttp: () => ({ getResponse: () => ({ setHeader }) }),
    } as unknown as ExecutionContext;
    const handle = jest.fn(() => {
      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'private, no-store',
      );
      return of('isi');
    });

    const result = await lastValueFrom(
      new NoStoreInterceptor().intercept(context, {
        handle,
      } as CallHandler),
    );

    expect(result).toBe('isi');
    expect(handle).toHaveBeenCalledTimes(1);
    expect(NO_STORE_CACHE_CONTROL).toBe('private, no-store');
  });
});

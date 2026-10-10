import { Reflector } from '@nestjs/core';
import { ThrottlerStorageService } from '@nestjs/throttler';
import {
  USER_TRACKER_PREFIX,
  UserThrottlerGuard,
} from './user-throttler.guard';

class ExposedGuard extends UserThrottlerGuard {
  track(req: Record<string, unknown>) {
    return this.getTracker(req);
  }
}

describe('UserThrottlerGuard', () => {
  const storage = new ThrottlerStorageService();
  const guard = new ExposedGuard(
    [{ ttl: 60_000, limit: 100 }],
    storage,
    new Reflector(),
  );

  afterAll(() => storage.onApplicationShutdown());

  it('menghitung kuota per akun saat sesi sudah terbaca', async () => {
    await expect(guard.track({ user: { id: 7 }, ip: '10.0.0.1' })).resolves.toBe(
      `${USER_TRACKER_PREFIX}7`,
    );
  });

  it('memberi kuota berbeda untuk dua akun di balik IP yang sama', async () => {
    const first = await guard.track({ user: { id: 1 }, ip: '10.0.0.1' });
    const second = await guard.track({ user: { id: 2 }, ip: '10.0.0.1' });

    expect(first).not.toBe(second);
  });

  it('memakai IP untuk request tanpa sesi (mis. login)', async () => {
    await expect(guard.track({ ip: '10.0.0.9' })).resolves.toBe('10.0.0.9');
  });

  it.each([['7'], [Number.NaN], [1.5], [null], [undefined], [{}]])(
    'mengabaikan id yang bukan bilangan bulat aman (%p)',
    async (id) => {
      await expect(guard.track({ user: { id }, ip: '10.0.0.9' })).resolves.toBe(
        '10.0.0.9',
      );
    },
  );

  it('tidak bisa bentrok dengan IP karena memakai prefix', async () => {
    const tracker = await guard.track({ user: { id: 3 }, ip: '10.0.0.1' });

    expect(tracker.startsWith(USER_TRACKER_PREFIX)).toBe(true);
    expect(tracker).not.toBe('10.0.0.1');
  });
});

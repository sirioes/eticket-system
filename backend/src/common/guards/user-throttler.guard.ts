import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

export const USER_TRACKER_PREFIX = 'user:';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, any>): Promise<string> {
    const userId: unknown = req.user?.id;
    if (typeof userId === 'number' && Number.isSafeInteger(userId)) {
      return Promise.resolve(`${USER_TRACKER_PREFIX}${userId}`);
    }
    return super.getTracker(req);
  }
}

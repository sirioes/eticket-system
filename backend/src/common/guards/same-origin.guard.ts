import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { CROSS_SITE_MESSAGE, isAllowedFetchSite } from './fetch-metadata.guard';

@Injectable()
export class SameOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (isAllowedFetchSite(request)) return true;

    throw new ForbiddenException(CROSS_SITE_MESSAGE);
  }
}

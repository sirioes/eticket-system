import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

export const CROSS_SITE_MESSAGE = 'Cross-site request is not allowed';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ALLOWED_SITES = new Set(['same-origin', 'none']);

export function isAllowedFetchSite(request: Request): boolean {
  const site = request.headers['sec-fetch-site'];
  if (site === undefined) return true;
  return typeof site === 'string' && ALLOWED_SITES.has(site);
}

@Injectable()
export class FetchMetadataGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
    if (isAllowedFetchSite(request)) return true;

    throw new ForbiddenException(CROSS_SITE_MESSAGE);
  }
}

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenIssuer, AccessTokenPayload } from '../application/ports/access-token-issuer';

@Injectable()
export class JwtAccessTokenIssuer implements AccessTokenIssuer {
  constructor(private readonly jwt: JwtService) {}

  issue(payload: AccessTokenPayload): Promise<string> {
    return this.jwt.signAsync({ sub: payload.sub });
  }
}
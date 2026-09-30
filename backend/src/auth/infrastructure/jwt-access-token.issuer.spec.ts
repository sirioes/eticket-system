import { JwtService } from '@nestjs/jwt';
import { ACCESS_TOKEN_TTL } from '../auth.constants';
import { JwtAccessTokenIssuer } from './jwt-access-token.issuer';

const SECRET = 'issuer-test-secret-at-least-32-characters';

describe('JwtAccessTokenIssuer', () => {
  const jwt = new JwtService({ secret: SECRET, signOptions: { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_TTL } });
  const issuer = new JwtAccessTokenIssuer(jwt);

  it('signs an HS256 token that carries only sub, iat and exp', async () => {
    const token = await issuer.issue({ sub: 7 });
    const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
    const payload = await jwt.verifyAsync<Record<string, unknown>>(token, { algorithms: ['HS256'] });

    expect(header.alg).toBe('HS256');
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub']);
    expect(payload.sub).toBe(7);
  });

  it('expires the token after 12 hours', async () => {
    const token = await issuer.issue({ sub: 7 });
    const payload = await jwt.verifyAsync<{ iat: number; exp: number }>(token);

    expect(payload.exp - payload.iat).toBe(12 * 60 * 60);
  });
});
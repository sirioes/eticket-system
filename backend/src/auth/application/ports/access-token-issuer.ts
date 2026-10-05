export interface AccessTokenPayload {
  sub: number;
}

export abstract class AccessTokenIssuer {
  abstract issue(payload: AccessTokenPayload): Promise<string>;
}
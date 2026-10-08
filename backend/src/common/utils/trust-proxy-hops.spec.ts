import {
  DEFAULT_TRUST_PROXY_HOPS,
  MAX_TRUST_PROXY_HOPS,
  parseTrustProxyHops,
} from './trust-proxy-hops';

describe('parseTrustProxyHops', () => {
  it.each([[undefined], [''], ['   ']])(
    'falls back to the default for %j',
    (raw) => {
      expect(parseTrustProxyHops(raw)).toBe(DEFAULT_TRUST_PROXY_HOPS);
    },
  );

  it.each([
    ['0', 0],
    ['1', 1],
    [' 2 ', 2],
    [String(MAX_TRUST_PROXY_HOPS), MAX_TRUST_PROXY_HOPS],
  ])('accepts %j', (raw, expected) => {
    expect(parseTrustProxyHops(raw)).toBe(expected);
  });

  it.each([
    ['true'],
    ['-1'],
    ['1.5'],
    ['1e1'],
    ['0x1'],
    ['loopback'],
    ['127.0.0.1'],
    [String(MAX_TRUST_PROXY_HOPS + 1)],
  ])('rejects %j', (raw) => {
    expect(() => parseTrustProxyHops(raw)).toThrow('TRUST_PROXY_HOPS');
  });
});
